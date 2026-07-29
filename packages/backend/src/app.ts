import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { auth } from 'express-openid-connect';
import chatRoutes from './routes/chat.js';
import accountsRoutes from './routes/accounts.js';
import myaccountRoutes from './routes/myaccount.js';
import { handleMyAccountCallback } from './routes/myaccount-callback.js';
import { refreshTokenService } from './services/refreshTokenService.js';

const app = express();

// Trust the load balancer / CloudFront X-Forwarded-For header
app.set('trust proxy', 1);

app.use(helmet({
  // Allow cross-origin requests from the frontend subdomain
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));

app.use(express.json());

// Rate limit chat API only
const chatLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: 'Too many requests, please try again later',
});

// Auth0 OIDC middleware — handles /auth/login, /auth/callback, /auth/logout
const oidcConfig = {
  authRequired: false,
  auth0Logout: true,
  secret: process.env.SESSION_SECRET!,
  baseURL: process.env.BASE_URL || 'http://localhost:3001',
  clientID: process.env.AUTH0_BFF_CLIENT_ID!,
  clientSecret: process.env.AUTH0_BFF_CLIENT_SECRET!,
  issuerBaseURL: `https://${process.env.AUTH0_DOMAIN}`,
  authorizationParams: {
    response_type: 'code',
    scope: 'openid profile email offline_access',
  },
  routes: {
    login: '/auth/login',
    logout: '/auth/logout',
    callback: '/auth/callback',
    postLogoutRedirect: process.env.FRONTEND_URL || 'http://localhost:3000',
  },
  session: {
    absoluteDuration: 30 * 24 * 60 * 60, // 30 days
    cookie: {
      // Shared across *.demo-connect.us — works for both frontend and API subdomains
      domain: process.env.COOKIE_DOMAIN || undefined,
      sameSite: 'None' as const,
      secure: process.env.NODE_ENV === 'production',
    },
  },
  // Capture refresh token after login and store server-side for MyAccount API calls
  afterCallback: async (_req: any, _res: any, session: any) => {
    const sub = session.claims?.sub;
    const refreshToken = session.refresh_token;
    if (sub && refreshToken) {
      try {
        await refreshTokenService.saveRefreshToken(sub, refreshToken);
        console.log(`Stored refresh token for ${sub}`);
      } catch (err) {
        console.error('Failed to store refresh token after login:', err);
      }
    }
    return session;
  },
};

app.use(auth(oidcConfig));

// Health check (public)
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Current user (used by frontend to check session state)
app.get('/auth/me', (req, res) => {
  if (!req.oidc.isAuthenticated()) {
    res.status(401).json({ authenticated: false });
    return;
  }
  res.json({
    authenticated: true,
    user: {
      sub: req.oidc.user?.sub,
      name: req.oidc.user?.name,
      email: req.oidc.user?.email,
      picture: req.oidc.user?.picture,
    },
  });
});

// Public MyAccount callback (Auth0 redirects here after connected account OAuth)
app.get('/api/myaccount/callback', handleMyAccountCallback);

// Protected API routes — require authenticated session
const requireAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (!req.oidc.isAuthenticated()) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
};

app.use('/api/chat', requireAuth, chatLimiter, chatRoutes);
app.use('/api/accounts', requireAuth, accountsRoutes);
app.use('/api/myaccount', requireAuth, myaccountRoutes);

// Global error handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
  });
});

export default app;
