# Architecture Documentation

## System Overview

The Connected Accounts Bot is a full-stack TypeScript application that bridges Gmail and Discord using Auth0's Connected Accounts feature. Users can search their Gmail using natural language and receive results in Discord DMs.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                           Frontend (React)                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │  Auth0 React │  │   Supabase   │  │   Chat Interface     │  │
│  │     SDK      │  │  Real-time   │  │  Connection Status   │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                         HTTPS (JWT)
                              │
┌─────────────────────────────────────────────────────────────────┐
│                        Backend (Express)                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │     JWT      │  │     Rate     │  │      Routes          │  │
│  │ Validation   │  │   Limiting   │  │  /chat  /accounts    │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    Services Layer                         │  │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌────────────┐ │  │
│  │  │  Auth   │  │   LLM   │  │  Gmail  │  │  Discord   │ │  │
│  │  │ Service │  │ Service │  │ Service │  │  Service   │ │  │
│  │  └─────────┘  └─────────┘  └─────────┘  └────────────┘ │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
         │                │              │              │
         │                │              │              │
    ┌────▼────┐      ┌───▼───┐     ┌───▼───┐     ┌────▼─────┐
    │  Auth0  │      │OpenAI │     │ Gmail │     │ Discord  │
    │Management│      │  API  │     │  API  │     │ REST API │
    │   API   │      └───────┘     └───────┘     └──────────┘
    └────┬────┘
         │
         │ Stores user tokens
         │
    ┌────▼────────┐
    │  Supabase   │
    │ PostgreSQL  │
    │   (Prisma)  │
    └─────────────┘
```

## Data Flow

### Authentication Flow

1. User clicks "Login" in React app
2. Auth0 React SDK redirects to Auth0 Universal Login
3. User authenticates and authorizes application
4. Auth0 redirects back with authorization code
5. Auth0 React SDK exchanges code for JWT access token
6. Frontend stores JWT and includes it in API requests
7. Backend validates JWT on each request

### Connected Accounts Flow

1. User clicks "Connect Google" or "Connect Discord"
2. Frontend generates Auth0 authorization URL with specific connection
3. User is redirected to Google/Discord OAuth flow
4. After authorization, Auth0 stores the OAuth tokens
5. Backend can retrieve tokens via Auth0 Management API
6. Tokens are used to make API calls on behalf of the user

### Chat Message Flow

1. User submits natural language prompt
2. Frontend sends POST to `/api/chat/message` with JWT
3. Backend validates JWT and extracts user ID
4. **LLM Service**: OpenAI extracts search parameters (query, dates, sender, etc.)
5. **Auth Service**: Retrieves user's Google OAuth token from Auth0
6. **Gmail Service**: Searches Gmail using token and parameters
7. **LLM Service**: Formats results into readable message
8. **Auth Service**: Retrieves user's Discord OAuth token from Auth0
9. **Discord Service**: Sends formatted results to user's Discord DMs
10. **Database**: Saves chat message with metadata to Supabase
11. Backend returns response to frontend
12. Frontend updates UI via Supabase real-time subscription

## Technology Stack

### Frontend
- **React 18**: UI library with hooks
- **TypeScript**: Type safety
- **Vite**: Fast build tool and dev server
- **TailwindCSS**: Utility-first CSS framework
- **Auth0 React SDK**: Authentication
- **TanStack Query**: Server state management
- **Supabase JS Client**: Real-time subscriptions
- **Axios**: HTTP client

### Backend
- **Express**: Web framework
- **TypeScript**: Type safety
- **Prisma ORM**: Database client with type generation
- **Express JWT**: JWT validation middleware
- **Helmet**: Security headers
- **Rate Limiting**: DDoS protection
- **OpenAI SDK**: LLM integration
- **Google APIs**: Gmail access
- **Axios**: HTTP client for Discord API

### Infrastructure
- **Supabase**: PostgreSQL database with real-time
- **Auth0**: Authentication and connected accounts
- **OpenAI**: Natural language processing
- **Gmail API**: Email search
- **Discord API**: Direct messaging

## Database Schema

```prisma
model User {
  id        String   @id @default(uuid())
  auth0Id   String   @unique
  email     String   @unique
  name      String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  connectedAccounts ConnectedAccount[]
  chatMessages      ChatMessage[]
}

model ConnectedAccount {
  id             String   @id @default(uuid())
  userId         String
  provider       String   // "google" or "discord"
  providerUserId String
  email          String?  // For Google
  username       String?  // For Discord
  connectionId   String
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  user User @relation(fields: [userId], references: [id])

  @@unique([userId, provider])
}

model ChatMessage {
  id               String   @id @default(uuid())
  userId           String
  prompt           String
  emailsFound      Int      @default(0)
  emailsSent       Int      @default(0)
  discordMessageId String?
  status           String   @default("pending")
  errorMessage     String?
  processingTimeMs Int?
  tokensUsed       Int?
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  user User @relation(fields: [userId], references: [id])
}
```

## API Endpoints

### Public Endpoints
- `GET /api/health` - Health check

### Protected Endpoints (JWT required)
- `POST /api/chat/message` - Process chat message
  - Body: `{ prompt: string }`
  - Returns: `{ emailsFound, emailsSent, discordMessageId, metadata }`

- `GET /api/chat/history` - Get chat history
  - Query: `?limit=50`
  - Returns: Array of chat messages

- `GET /api/accounts/status` - Get connection status
  - Returns: `{ google: { connected, email }, discord: { connected, username } }`

## Security Considerations

### Authentication & Authorization
- JWT validation on all protected endpoints
- Auth0 manages user sessions and token refresh
- Tokens never stored in browser localStorage (handled by Auth0 SDK)
- Short-lived access tokens with refresh token rotation

### API Security
- Rate limiting: 30 requests per 15 minutes per IP
- Helmet.js security headers (CSP, HSTS, etc.)
- CORS restricted to frontend origin
- Input validation with Zod schemas
- SQL injection protection via Prisma parameterized queries

### Secrets Management
- Environment variables for all secrets
- Never commit .env files
- Auth0 securely stores OAuth tokens
- No email content stored in database (only metadata)

### Data Privacy
- Users can only access their own data
- OAuth tokens encrypted at rest by Auth0
- Database connections use SSL/TLS
- Minimal data retention (configurable)

## Scalability Considerations

### Current Limitations
- Single-region deployment
- No caching layer
- Synchronous request processing
- Limited to 30 requests per 15 minutes

### Scaling Strategies

**Horizontal Scaling**:
- Deploy multiple backend instances behind load balancer
- Use session affinity or stateless JWT validation
- Supabase handles database connection pooling

**Caching**:
- Redis for Auth0 Management API tokens
- Cache user connection status (5-minute TTL)
- Cache LLM responses for common queries

**Async Processing**:
- Queue long-running operations (email search, Discord sends)
- Use background workers (Bull/BullMQ)
- Provide real-time status updates via Supabase

**Rate Limiting**:
- Move to distributed rate limiter (Redis)
- Per-user limits instead of per-IP
- Tiered limits based on plan

## Monitoring & Observability

### Recommended Tools
- **Sentry**: Error tracking and performance monitoring
- **Datadog/New Relic**: APM and infrastructure monitoring
- **LogDNA/Papertrail**: Centralized logging
- **Auth0 Logs**: Authentication event monitoring

### Key Metrics to Track
- API response times
- JWT validation success rate
- Auth0 token refresh failures
- Gmail API rate limit consumption
- Discord API rate limit consumption
- OpenAI token usage and costs
- Database query performance
- Real-time subscription health

### Alerting Rules
- Error rate > 5% for 5 minutes
- P95 latency > 2 seconds
- Auth0 token refresh failure rate > 10%
- Database connection pool exhaustion
- OpenAI API rate limit approaching

## Development Workflow

### Local Development
1. Clone repository
2. Run `pnpm install`
3. Configure `.env` files
4. Run `pnpm prisma migrate dev`
5. Start backend: `cd packages/backend && pnpm dev`
6. Start frontend: `cd packages/frontend && pnpm dev`

### Code Organization
- **Services**: Business logic, API integrations
- **Routes**: HTTP endpoint handlers
- **Middleware**: Request processing (auth, validation)
- **Types**: Shared TypeScript interfaces
- **Components**: React UI components
- **Hooks**: Reusable React logic

### Testing Strategy
- Unit tests: Services and utilities
- Integration tests: API endpoints
- E2E tests: Critical user flows
- Manual testing: OAuth flows (hard to automate)

## Deployment

### Frontend (Vercel)
- Automatic deployments from Git
- Environment variables in Vercel dashboard
- Preview deployments for PRs
- CDN distribution

### Backend (Railway/Fly.io)
- Dockerfile or Buildpack deployment
- Environment variables in platform
- Auto-scaling based on load
- Health check monitoring

### Database (Supabase)
- Managed PostgreSQL with automatic backups
- Connection pooling enabled
- Read replicas for scaling
- Point-in-time recovery

## Future Enhancements

### Planned Features
- Multi-turn conversations with context
- Email attachment handling
- Google Calendar integration
- Discord channel posting (requires bot)
- Saved searches and templates
- Advanced filters (labels, attachments, etc.)

### Technical Improvements
- GraphQL API for flexible queries
- Server-sent events for streaming responses
- WebSockets for real-time updates
- Background job processing
- Caching layer (Redis)
- API versioning
- Comprehensive test coverage

## Troubleshooting

### Common Issues

**"Invalid token"**
- Check AUTH0_AUDIENCE matches in frontend and backend
- Verify JWT is being sent in Authorization header
- Check Auth0 API configuration

**"Google account not connected"**
- Ensure user completed Google OAuth flow
- Check Auth0 Management API permissions
- Verify Gmail API scope is included

**"Discord DM failed"**
- Check Discord OAuth token is valid
- Verify Discord connection in Auth0
- Check user hasn't blocked the bot

**Database connection errors**
- Check DATABASE_URL is correct
- Verify Supabase project is running
- Check connection pool settings

## Contributing

See CONTRIBUTING.md for development guidelines, code style, and PR process.

## License

MIT License - see LICENSE file for details.
