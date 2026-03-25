# Quick Setup Guide

This guide will help you get the Connected Accounts Bot running locally in under 30 minutes.

## Step 1: Prerequisites Check

Before starting, ensure you have:

- [ ] Node.js 18+ installed (`node --version`)
- [ ] npm 8+ installed (comes with Node.js - check with `npm --version`)
- [ ] Git installed
- [ ] A code editor (VS Code recommended)

## Step 2: Install Dependencies

```bash
# From the project root
npm install
```

This will install all dependencies for both frontend and backend packages.

## Step 3: Auth0 Setup (15 minutes)

### 3.1 Create Auth0 Account
1. Go to https://auth0.com and sign up for a free account
2. Create a new tenant (e.g., "my-connected-bot")

### 3.2 Create SPA Application
1. Dashboard > Applications > Create Application
2. Name: "Connected Accounts Bot Frontend"
3. Type: "Single Page Web Applications"
4. Click "Create"
5. Go to Settings tab and configure:
   - Allowed Callback URLs: `http://localhost:3000/callback, http://localhost:3000`
   - Allowed Logout URLs: `http://localhost:3000`
   - Allowed Web Origins: `http://localhost:3000`
   - Allowed Origins (CORS): `http://localhost:3000`
6. Click "Save Changes"
7. **Copy the Client ID** - you'll need it for `.env`

### 3.3 Create M2M Application
1. Dashboard > Applications > Create Application
2. Name: "Connected Accounts Bot Backend"
3. Type: "Machine to Machine Applications"
4. Authorize for "Auth0 Management API"
5. Select all scopes under `read:users`, `update:users`, `read:user_idp_tokens`
6. Click "Authorize"
7. Go to Settings tab
8. **Copy the Client ID and Client Secret** - you'll need them for `.env`

### 3.4 Create API
1. Dashboard > Applications > APIs > Create API
2. Name: "Connected Accounts Bot API"
3. Identifier: `https://api.connectedbot.local` (can be any URL, doesn't need to exist)
4. Signing Algorithm: RS256
5. Click "Create"

### 3.5 Configure Google Social Connection
1. Dashboard > Authentication > Social
2. Click on "Google"
3. Toggle "Use Auth0 dev keys" (for testing)
4. In the "Permissions" tab, add scope: `https://www.googleapis.com/auth/gmail.readonly`
5. Click "Save"

### 3.6 Configure Discord Social Connection

First, create a Discord Application:
1. Go to https://discord.com/developers/applications
2. Click "New Application"
3. Name it "Connected Accounts Bot"
4. Go to OAuth2 > General
5. Add Redirect URL: `https://YOUR-AUTH0-DOMAIN.auth0.com/login/callback`
   (Replace YOUR-AUTH0-DOMAIN with your actual Auth0 domain)
6. **Copy Client ID and Client Secret**

Then, configure in Auth0:
1. Dashboard > Authentication > Social
2. Click "Create Connection"
3. Select "Discord"
4. Enter Client ID and Client Secret from Discord
5. In Permissions/Scopes, enter: `identify email`
6. Click "Create"
7. Go to Applications tab and enable for your SPA application

**Note**: Discord's `dm_channels.messages.write` scope requires additional verification from Discord. For development, we'll use the Discord REST API with the user's token.

## Step 4: Supabase Setup (5 minutes)

### 4.1 Create Supabase Project
1. Go to https://supabase.com and sign up
2. Create a new project
3. Choose a database password (save it!)
4. Wait for project to provision (~2 minutes)

### 4.2 Get Connection Details
1. Go to Project Settings > Database
2. Copy the "Connection string" (URI format)
3. Replace `[YOUR-PASSWORD]` with your database password
4. Go to Project Settings > API
5. Copy the "URL" and "anon/public" key

## Step 5: OpenAI Setup (2 minutes)

1. Go to https://platform.openai.com
2. Sign up or log in
3. Go to API Keys
4. Create a new API key
5. **Copy the key** - you won't see it again!

## Step 6: Configure Environment Variables

### 6.1 Backend Environment

Create `packages/backend/.env`:

```bash
# Auth0
AUTH0_DOMAIN=YOUR-TENANT.auth0.com
AUTH0_API_CLIENT_ID=YOUR-M2M-CLIENT-ID
AUTH0_API_CLIENT_SECRET=YOUR-M2M-CLIENT-SECRET
AUTH0_AUDIENCE=https://api.connectedbot.local
AUTH0_ISSUER_BASE_URL=https://YOUR-TENANT.auth0.com

# Database (from Supabase)
DATABASE_URL=postgresql://postgres:YOUR-PASSWORD@db.YOUR-PROJECT.supabase.co:5432/postgres

# OpenAI
OPENAI_API_KEY=sk-YOUR-OPENAI-KEY

# Server
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
```

### 6.2 Frontend Environment

Create `packages/frontend/.env`:

```bash
# Auth0
VITE_AUTH0_DOMAIN=YOUR-TENANT.auth0.com
VITE_AUTH0_CLIENT_ID=YOUR-SPA-CLIENT-ID
VITE_AUTH0_REDIRECT_URI=http://localhost:3000/callback
VITE_AUTH0_AUDIENCE=https://api.connectedbot.local

# API
VITE_API_BASE_URL=http://localhost:3001

# Supabase
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY=YOUR-ANON-KEY
```

## Step 7: Initialize Database

```bash
cd packages/backend
npm run prisma:generate
npm run prisma:migrate
```

This creates the database tables in Supabase.

## Step 8: Start the Application

Open two terminal windows:

**Terminal 1 - Backend:**
```bash
cd packages/backend
npm run dev
```

You should see: `🚀 Server running on port 3001`

**Terminal 2 - Frontend:**
```bash
cd packages/frontend
npm run dev
```

You should see: `Local: http://localhost:3000`

## Step 9: Test the Application

1. Open http://localhost:3000 in your browser
2. Click "Log In with Auth0"
3. Sign up or log in with any method
4. You should see the dashboard with "Connected Accounts" section

## Step 10: Connect Accounts

### Connect Google:
1. Click "Connect Google" button
2. Choose your Google account
3. Grant permissions to read Gmail
4. You'll be redirected back - you should see a green indicator

### Connect Discord:
1. Click "Connect Discord" button
2. Authorize the application
3. You'll be redirected back - you should see a green indicator

## Step 11: Test Gmail Search

In the chat interface, try:
- "Find email with invoice from last month"
- "Show me emails from support@example.com"
- "Find receipts from March"

The bot will:
1. Extract search parameters using AI
2. Search your Gmail
3. Send results to your Discord DMs
4. Show success message in the chat

## Troubleshooting

### "Callback URL mismatch"
- Check that Auth0 callback URLs include `http://localhost:3000/callback`
- Ensure no trailing slashes

### "Invalid token"
- Verify AUTH0_AUDIENCE matches in both frontend and backend `.env`
- Check AUTH0_DOMAIN is correct

### "Database connection failed"
- Verify DATABASE_URL has correct password
- Check Supabase project is running
- Ensure you ran `prisma migrate dev`

### "Google/Discord not connecting"
- Check that social connections are enabled in Auth0
- Verify redirect URLs are correct
- Check browser console for errors

### Backend won't start
- Ensure port 3001 is not in use: `lsof -ti:3001`
- Check all environment variables are set
- Review terminal for specific error messages

### Frontend won't start
- Ensure port 3000 is not in use: `lsof -ti:3000`
- Check all VITE_ environment variables are set
- Clear browser cache and try again

## Next Steps

- Customize the UI styling
- Add more search capabilities
- Deploy to production (see README.md)
- Add error tracking with Sentry
- Implement caching for better performance

## Getting Help

If you encounter issues:
1. Check the main README.md
2. Review Auth0 dashboard logs
3. Check browser console (F12)
4. Check backend terminal output
5. Review Supabase database logs

## Security Notes

- Never commit `.env` files
- Rotate API keys regularly
- Use Auth0 dev keys only for testing
- Set up proper scopes in production
- Enable 2FA on all service accounts
