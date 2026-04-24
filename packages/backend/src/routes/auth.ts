// Authentication routes for token management
// Handles refresh token storage for Federated Token Exchange
import { Router, Request, Response } from 'express';
import { authService } from '../services/authService.js';

const router = Router();

/**
 * POST /api/auth/refresh-token
 * Store the user's Auth0 refresh token for Federated Token Exchange
 *
 * This endpoint should be called after the user logs in with offline_access scope.
 * The frontend should call this with the refresh token from Auth0.
 *
 * Body: { refreshToken: string }
 */
router.post('/refresh-token', async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;
    const auth0UserId = (req as any).auth?.sub;

    if (!auth0UserId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (!refreshToken) {
      res.status(400).json({ error: 'Refresh token required' });
      return;
    }

    await authService.storeRefreshToken(auth0UserId, refreshToken);

    console.log(`Stored refresh token for user ${auth0UserId}`);
    res.json({ success: true });
  } catch (error: any) {
    console.error('Failed to store refresh token:', error.message);
    res.status(500).json({
      error: 'Failed to store refresh token',
      message: error.message,
    });
  }
});

/**
 * DELETE /api/auth/refresh-token
 * Remove the user's stored refresh token (call on logout)
 */
router.delete('/refresh-token', async (req: Request, res: Response) => {
  try {
    const auth0UserId = (req as any).auth?.sub;

    if (!auth0UserId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    await authService.clearUserTokens(auth0UserId);

    console.log(`Cleared tokens for user ${auth0UserId}`);
    res.json({ success: true });
  } catch (error: any) {
    console.error('Failed to clear tokens:', error.message);
    res.status(500).json({
      error: 'Failed to clear tokens',
      message: error.message,
    });
  }
});

/**
 * GET /api/auth/token-status
 * Check if the user has a valid refresh token stored
 */
router.get('/token-status', async (req: Request, res: Response) => {
  try {
    const auth0UserId = (req as any).auth?.sub;

    if (!auth0UserId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { refreshTokenService } = await import('../services/refreshTokenService.js');
    const hasRefreshToken = await refreshTokenService.hasValidRefreshToken(auth0UserId);

    res.json({
      hasRefreshToken,
      federatedTokenExchangeEnabled: process.env.USE_FEDERATED_TOKEN_EXCHANGE !== 'false',
    });
  } catch (error: any) {
    console.error('Failed to check token status:', error.message);
    res.status(500).json({
      error: 'Failed to check token status',
      message: error.message,
    });
  }
});

export default router;
