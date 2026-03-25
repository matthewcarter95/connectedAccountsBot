// Account linking routes
import { Router, Request, Response } from 'express';
import axios from 'axios';
import { extractUserId } from '../middleware/auth.js';
import { authService } from '../services/authService.js';

const router = Router();

/**
 * POST /api/link/callback
 * Handle the OAuth callback and link the account
 */
router.post('/callback', async (req: Request, res: Response) => {
  try {
    const { code, connection } = req.body;
    const primaryUserId = extractUserId(req);

    if (!code || !connection) {
      return res.status(400).json({ error: 'Missing code or connection' });
    }

    // Exchange code for tokens
    const tokenResponse = await axios.post(
      `https://${process.env.AUTH0_DOMAIN}/oauth/token`,
      {
        grant_type: 'authorization_code',
        client_id: process.env.AUTH0_API_CLIENT_ID,
        client_secret: process.env.AUTH0_API_CLIENT_SECRET,
        code,
        redirect_uri: `${process.env.FRONTEND_URL}/callback`,
      }
    );

    // Get user info from the new token
    const userInfoResponse = await axios.get(
      `https://${process.env.AUTH0_DOMAIN}/userinfo`,
      {
        headers: {
          Authorization: `Bearer ${tokenResponse.data.access_token}`,
        },
      }
    );

    const secondaryUserId = userInfoResponse.data.sub;

    // Link the accounts
    if (secondaryUserId !== primaryUserId) {
      await authService.linkAccount(primaryUserId, secondaryUserId);
    }

    res.json({ success: true, message: 'Account linked successfully' });
  } catch (error: any) {
    console.error('Link callback error:', error);
    res.status(500).json({
      error: 'Failed to link account',
      message: error.response?.data?.error_description || error.message,
    });
  }
});

export default router;
