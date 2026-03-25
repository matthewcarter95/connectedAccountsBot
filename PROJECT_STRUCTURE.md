# Project Structure

```
connectedAccountsBot/
├── .claude/                          # Claude Code configuration
├── .git/                             # Git repository
├── packages/
│   ├── backend/                      # Express API Server
│   │   ├── src/
│   │   │   ├── middleware/
│   │   │   │   └── auth.ts          # JWT validation middleware
│   │   │   ├── routes/
│   │   │   │   ├── accounts.ts      # GET /api/accounts/status
│   │   │   │   └── chat.ts          # POST /api/chat/message, GET /api/chat/history
│   │   │   ├── services/
│   │   │   │   ├── authService.ts   # Auth0 Management API integration
│   │   │   │   ├── chatService.ts   # Main orchestration service
│   │   │   │   ├── discordService.ts # Discord REST API client
│   │   │   │   ├── gmailService.ts  # Gmail API client
│   │   │   │   └── llmService.ts    # OpenAI integration
│   │   │   ├── types/
│   │   │   │   └── index.ts         # TypeScript type definitions
│   │   │   └── app.ts               # Express server setup
│   │   ├── prisma/
│   │   │   └── schema.prisma        # Database schema (User, ConnectedAccount, ChatMessage)
│   │   ├── .env.example             # Environment variables template
│   │   ├── .eslintrc.json
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── frontend/                     # React SPA
│       ├── src/
│       │   ├── components/
│       │   │   ├── Auth/
│       │   │   │   ├── LoginButton.tsx
│       │   │   │   └── LogoutButton.tsx
│       │   │   ├── Chat/
│       │   │   │   └── ChatInterface.tsx   # Main chat UI with real-time updates
│       │   │   └── Dashboard/
│       │   │       └── ConnectionStatus.tsx # Shows connection status
│       │   ├── lib/
│       │   │   └── supabaseClient.ts      # Supabase client initialization
│       │   ├── services/
│       │   │   └── api.ts                 # API client with JWT management
│       │   ├── App.tsx                    # Main app component
│       │   ├── main.tsx                   # React entry point
│       │   └── index.css                  # TailwindCSS imports
│       ├── index.html
│       ├── .env.example
│       ├── .eslintrc.json
│       ├── package.json
│       ├── postcss.config.js
│       ├── tailwind.config.js
│       ├── tsconfig.json
│       ├── tsconfig.node.json
│       └── vite.config.ts
│
├── .env.example                      # Root environment template
├── .eslintrc.json                    # Root ESLint config
├── .gitignore
├── ARCHITECTURE.md                   # Technical architecture documentation
├── CLAUDE.md                         # Project overview for Claude
├── IMPLEMENTATION_SUMMARY.md         # Implementation status and checklist
├── package.json                      # Root package.json (monorepo)
├── pnpm-workspace.yaml              # pnpm workspace configuration
├── README.md                         # Main documentation
├── SETUP_GUIDE.md                   # Step-by-step setup instructions
└── verify-setup.sh                  # Setup verification script
```

## Key Files Explained

### Backend Core Files

**`src/app.ts`**
- Express server setup
- Middleware configuration (CORS, Helmet, rate limiting)
- Route mounting
- Error handling

**`src/services/chatService.ts`**
- Main orchestration layer
- Coordinates: LLM → Gmail → Discord flow
- Database operations via Prisma
- Error handling and retry logic

**`src/services/authService.ts`**
- Auth0 Management API client
- Retrieves user OAuth tokens for Google and Discord
- Token caching and refresh logic

**`src/services/llmService.ts`**
- OpenAI API integration
- Extracts search parameters from natural language
- Formats email results for Discord

**`src/services/gmailService.ts`**
- Gmail API wrapper
- Email search with filters
- Profile information retrieval

**`src/services/discordService.ts`**
- Discord REST API client
- DM sending functionality
- Message chunking for long messages

**`src/middleware/auth.ts`**
- JWT validation using Auth0 JWKS
- User ID extraction from token
- Error handling for auth failures

**`prisma/schema.prisma`**
- Database schema definition
- User, ConnectedAccount, ChatMessage models
- Relationships and constraints

### Frontend Core Files

**`src/App.tsx`**
- Main application component
- Layout and navigation
- Auth0 integration
- Conditional rendering based on auth state

**`src/components/Chat/ChatInterface.tsx`**
- Chat UI with message history
- Real-time updates via Supabase
- Message input and submission
- Loading and error states

**`src/components/Dashboard/ConnectionStatus.tsx`**
- Shows Google/Discord connection status
- Connect buttons with OAuth URLs
- Visual indicators for connection state

**`src/services/api.ts`**
- Axios HTTP client
- API endpoint functions
- JWT token management
- Type-safe request/response interfaces

**`src/lib/supabaseClient.ts`**
- Supabase client initialization
- Used for real-time subscriptions

**`src/main.tsx`**
- React app entry point
- Auth0Provider setup
- TanStack Query setup
- Root component mounting

### Configuration Files

**`package.json` (root)**
- Monorepo workspace configuration
- Shared development dependencies
- Parallel execution scripts

**`pnpm-workspace.yaml`**
- Defines workspace packages
- Enables pnpm workspaces

**`tsconfig.json`**
- TypeScript compiler options
- Strict mode enabled
- Module resolution settings

**`.eslintrc.json`**
- Linting rules
- TypeScript ESLint configuration
- Code style enforcement

**`vite.config.ts`**
- Vite build configuration
- React plugin
- Dev server settings

**`tailwind.config.js`**
- TailwindCSS configuration
- Content paths
- Theme customization

### Documentation Files

**`README.md`**
- Project overview
- Features and technology stack
- Setup instructions
- API documentation
- Deployment guide

**`SETUP_GUIDE.md`**
- Step-by-step setup walkthrough
- Auth0 configuration details
- Supabase setup
- Troubleshooting tips

**`ARCHITECTURE.md`**
- System architecture diagrams
- Data flow explanations
- Security considerations
- Scalability strategies
- Monitoring recommendations

**`IMPLEMENTATION_SUMMARY.md`**
- Implementation status checklist
- Features completed
- What's not included
- Next steps
- Maintenance notes

**`CLAUDE.md`**
- Project context for Claude Code
- Technology stack overview
- Development commands

## File Statistics

- **Total TypeScript files**: 20
- **Total React components**: 4
- **Total services**: 5
- **Total routes**: 2
- **Total configuration files**: 15+
- **Total documentation files**: 6
- **Estimated total lines of code**: ~2,500+

## Import Dependencies

### Backend Dependencies Tree
```
app.ts
├── express
├── cors, helmet, rate-limit (middleware)
├── middleware/auth.ts
│   ├── express-jwt
│   └── jwks-rsa
├── routes/chat.ts
│   ├── services/chatService
│   └── middleware/auth
├── routes/accounts.ts
│   ├── services/chatService
│   └── middleware/auth
└── services/chatService.ts
    ├── @prisma/client
    ├── services/authService
    ├── services/llmService
    ├── services/gmailService
    └── services/discordService
```

### Frontend Dependencies Tree
```
main.tsx
├── react, react-dom
├── @auth0/auth0-react
├── @tanstack/react-query
└── App.tsx
    ├── @auth0/auth0-react
    ├── services/api
    ├── components/Auth/LoginButton
    ├── components/Auth/LogoutButton
    ├── components/Dashboard/ConnectionStatus
    │   ├── @tanstack/react-query
    │   └── services/api
    └── components/Chat/ChatInterface
        ├── @tanstack/react-query
        ├── services/api
        ├── lib/supabaseClient
        └── @auth0/auth0-react
```

## Development Workflow

1. **Install**: `pnpm install` (from root)
2. **Configure**: Copy `.env.example` files and fill in values
3. **Migrate**: `cd packages/backend && pnpm prisma migrate dev`
4. **Develop**: 
   - Terminal 1: `cd packages/backend && pnpm dev`
   - Terminal 2: `cd packages/frontend && pnpm dev`
5. **Verify**: `./verify-setup.sh`
6. **Test**: Open http://localhost:3000

## Production Build

1. **Build backend**: `cd packages/backend && pnpm build`
2. **Build frontend**: `cd packages/frontend && pnpm build`
3. **Deploy backend**: Upload `dist/` to server
4. **Deploy frontend**: Upload `dist/` to CDN/static host
5. **Configure**: Set production environment variables
6. **Migrate**: Run `prisma migrate deploy` on production DB

## Key Design Patterns

- **Service Layer Pattern**: Business logic separated from routes
- **Repository Pattern**: Prisma as data access layer
- **JWT Authentication**: Stateless authentication
- **Component Composition**: React component hierarchy
- **Custom Hooks**: Reusable React logic
- **API Client Pattern**: Centralized HTTP client
- **Real-time Subscriptions**: Supabase for live updates
- **Error Boundaries**: Graceful error handling

## Security Layers

1. **Network**: CORS, rate limiting
2. **Authentication**: Auth0 JWT validation
3. **Authorization**: User-scoped data access
4. **Input Validation**: Zod schemas
5. **Database**: Prisma parameterized queries
6. **Headers**: Helmet.js security headers
7. **Secrets**: Environment variables
8. **Transport**: HTTPS in production
