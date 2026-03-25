// Main Express application
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { validateJWT, handleJWTError } from './middleware/auth.js';
import chatRoutes from './routes/chat.js';
import accountsRoutes from './routes/accounts.js';
import myaccountRoutes from './routes/myaccount.js';
import { handleLinkCallback } from './routes/link-callback.js';
import { handleMyAccountCallback } from './routes/myaccount-callback.js';

const app = express();
const port = process.env.PORT || 3001;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));

// Body parsing
app.use(express.json());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // 30 requests per window
  message: 'Too many requests, please try again later',
});

// Health check endpoint (public)
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Public callbacks (no JWT required)
app.get('/api/myaccount/link-callback', handleLinkCallback); // Legacy identity linking
app.get('/api/myaccount/callback', handleMyAccountCallback); // MyAccount Connected Accounts callback

// Protected routes (require JWT)
app.use('/api/chat', validateJWT, limiter, chatRoutes);
app.use('/api/accounts', validateJWT, accountsRoutes);
app.use('/api/myaccount', validateJWT, myaccountRoutes);

// JWT error handler
app.use(handleJWTError);

// Global error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
  });
});

// Start server
app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
  console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔒 Auth0 Domain: ${process.env.AUTH0_DOMAIN}`);
});

export default app;
