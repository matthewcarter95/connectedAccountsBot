// Auth diagnostic routes
// The login/callback/logout flow is handled by express-openid-connect in app.ts.
import { Router, Request, Response } from 'express';
import { extractUserId } from '../middleware/auth.js';
import { refreshTokenService } from '../services/refreshTokenService.js';

const router = Router();

/**
 * GET /api/auth/token-status
 * Diagnostic: check whether a refresh token is stored for this user.
 */
router.get('/token-status', async (req: Request, res: Response) => {
  try {
    const userId = extractUserId(req);
    const hasRefreshToken = await refreshTokenService.hasValidRefreshToken(userId);
    res.json({ hasRefreshToken, federatedTokenExchangeEnabled: true });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to check token status', message: error.message });
  }
});

export default router;
