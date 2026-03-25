# Connected Accounts Bot

A full-stack web application that uses Auth0 Connected Accounts to enable users to search their Gmail via natural language prompts and automatically send results to their Discord DMs.

## Features

- Auth0 authentication with Google and Discord Connected Accounts
- Natural language Gmail search using OpenAI LLM
- Automatic Discord DM delivery of search results
- Real-time chat interface with Supabase
- PostgreSQL database for chat history
- TypeScript monorepo with pnpm workspaces

## Prerequisites

- Node.js 18+
- npm 8+ (comes with Node.js)
- Auth0 account
- Supabase account (PostgreSQL database)
- OpenAI API key
- Discord Application
- Google Cloud Console project (for Gmail API)

## Project Structure

```
connectedAccountsBot/
├── packages/
│   ├── backend/          # Express API server
│   │   ├── src/
│   │   │   ├── routes/   # API routes
│   │   │   ├── services/ # Business logic
│   │   │   └── middleware/
│   │   └── prisma/       # Database schema
│   └── frontend/         # React + Vite SPA
│       └── src/
│           ├── components/
│           ├── hooks/
│           └── services/
└── package.json
```

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Auth0

#### Create Auth0 Applications

1. **SPA Application** (for frontend):
   - Go to Auth0 Dashboard > Applications > Create Application
   - Choose "Single Page Web Applications"
   - Configure:
     - Allowed Callback URLs: `http://localhost:3000/callback`
     - Allowed Logout URLs: `http://localhost:3000`
     - Allowed Web Origins: `http://localhost:3000`
     - Allowed Origins (CORS): `http://localhost:3000`

2. **API Application** (for backend):
   - Go to Auth0 Dashboard > Applications > Create Application
   - Choose "Machine to Machine Applications"
   - Select "Auth0 Management API"
   - Enable all permissions for Users and Connections

3. **Create API**:
   - Go to Auth0 Dashboard > Applications > APIs > Create API
   - Name: "Connected Accounts Bot API"
   - Identifier: `https://api.yourdomain.com`
   - Signing Algorithm: RS256

#### Configure Social Connections

1. **Google Connection**:
   - Go to Auth0 Dashboard > Authentication > Social
   - Enable Google
   - Add scope: `https://www.googleapis.com/auth/gmail.readonly`
   - You can use Auth0's dev keys initially

2. **Discord Connection**:
   - Create Discord Application at https://discord.com/developers/applications
   - Add OAuth2 Redirect URI: `https://[your-auth0-tenant].auth0.com/login/callback`
   - In Auth0 Dashboard > Authentication > Social > Discord:
     - Enable Discord
     - Add Client ID and Client Secret from Discord
     - Add scopes: `identify`, `email`, `dm_channels.messages.write`

### 3. Configure Supabase

1. Create a Supabase project at https://supabase.com
2. Get your connection string from Project Settings > Database
3. Get your publishable (anon) key from Project Settings > API

### 4. Configure Environment Variables

#### Backend (.env)

Create `packages/backend/.env`:

```bash
# Auth0
AUTH0_DOMAIN=your-tenant.auth0.com
AUTH0_API_CLIENT_ID=your-m2m-client-id
AUTH0_API_CLIENT_SECRET=your-m2m-secret
AUTH0_AUDIENCE=https://api.yourdomain.com
AUTH0_ISSUER_BASE_URL=https://your-tenant.auth0.com

# Database
DATABASE_URL=postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres

# OpenAI
OPENAI_API_KEY=sk-xxx

# Server
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
```

#### Frontend (.env)

Create `packages/frontend/.env`:

```bash
# Auth0
VITE_AUTH0_DOMAIN=your-tenant.auth0.com
VITE_AUTH0_CLIENT_ID=your-spa-client-id
VITE_AUTH0_REDIRECT_URI=http://localhost:3000/callback
VITE_AUTH0_AUDIENCE=https://api.yourdomain.com

# API
VITE_API_BASE_URL=http://localhost:3001

# Supabase
VITE_SUPABASE_URL=https://[project-ref].supabase.co
VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY=your-anon-key
```

### 5. Set Up Database

```bash
cd packages/backend
npm run prisma:generate
npm run prisma:migrate
```

### 6. Run the Application

In separate terminals:

```bash
# Terminal 1: Backend
cd packages/backend
npm run dev

# Terminal 2: Frontend
cd packages/frontend
npm run dev
```

The frontend will open at http://localhost:3000
The backend will run at http://localhost:3001

## Usage

1. Open http://localhost:3000
2. Click "Log In with Auth0"
3. Connect your Google account (click "Connect Google")
4. Connect your Discord account (click "Connect Discord")
5. Use the chat interface to search Gmail:
   - Example: "Find email with invoice from March"
   - Example: "Show me emails from john@example.com about project updates"
6. Results will be sent to your Discord DMs automatically

## Architecture

### Data Flow

1. User enters natural language prompt
2. Frontend sends to `/api/chat/message`
3. Backend validates JWT token
4. LLM (OpenAI) extracts search parameters
5. Backend retrieves user's Google OAuth token from Auth0
6. Gmail API searches emails
7. Backend retrieves user's Discord OAuth token from Auth0
8. Discord API sends formatted results to user's DMs
9. Response returned to frontend
10. Supabase real-time updates reflect in chat UI

### Key Technologies

- **Frontend**: React 18, TypeScript, Vite, TailwindCSS, Auth0 React SDK
- **Backend**: Express, TypeScript, Prisma ORM
- **Database**: Supabase PostgreSQL
- **Authentication**: Auth0 with Connected Accounts
- **LLM**: OpenAI GPT-4
- **APIs**: Gmail API, Discord REST API

## API Endpoints

### Public
- `GET /api/health` - Health check

### Protected (require JWT)
- `POST /api/chat/message` - Send a chat message
- `GET /api/chat/history` - Get chat history
- `GET /api/accounts/status` - Get connection status

## Security Features

- JWT validation on all protected endpoints
- CSRF protection via Auth0 state parameter
- Rate limiting (30 requests per 15 minutes)
- Helmet.js security headers
- Prisma parameterized queries
- CORS configuration
- No storage of email content

## Development

### Available Scripts

```bash
# Root
npm run dev       # Run both frontend and backend
npm run build     # Build all packages
npm run lint      # Lint all packages
npm run clean     # Clean all packages

# Backend
npm run prisma:generate  # Generate Prisma client
npm run prisma:migrate   # Run migrations
npm run prisma:studio    # Open Prisma Studio

# Frontend
npm run dev       # Start dev server
npm run build     # Build for production
npm run preview   # Preview production build
```

### Database Management

```bash
# View database in browser
cd packages/backend
npm run prisma:studio

# Create migration
npx prisma migrate dev --name your_migration_name

# Reset database
npx prisma migrate reset
```

## Troubleshooting

### "Google account not connected"
- Ensure you clicked "Connect Google" in the dashboard
- Check that Google connection is enabled in Auth0
- Verify Gmail API scope is included

### "Discord account not connected"
- Ensure you clicked "Connect Discord" in the dashboard
- Check Discord application has correct scopes
- Verify Discord connection is configured in Auth0

### Database connection errors
- Verify DATABASE_URL is correct
- Check Supabase project is running
- Ensure database is accessible from your IP

### JWT validation errors
- Verify AUTH0_DOMAIN and AUTH0_AUDIENCE match
- Check Auth0 API configuration
- Ensure frontend is using correct Auth0 client ID

## Production Deployment

### Checklist

- [ ] Update CORS origins for production domain
- [ ] Set NODE_ENV=production
- [ ] Configure production Auth0 callback URLs
- [ ] Enable Supabase connection pooling
- [ ] Set up error tracking (e.g., Sentry)
- [ ] Configure rate limits appropriately
- [ ] Set up monitoring and logging
- [ ] Use production OpenAI API key with rate limits

### Recommended Platforms

- **Frontend**: Vercel, Netlify
- **Backend**: Railway, Fly.io, Render
- **Database**: Supabase (already configured)

## License

MIT

## Support

For issues and questions:
- Check the troubleshooting section
- Review Auth0 dashboard logs
- Check browser console for frontend errors
- Check backend logs for API errors
