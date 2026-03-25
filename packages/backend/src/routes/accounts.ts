// Connected accounts routes
import { Router, Request, Response } from 'express';
import { chatService } from '../services/chatService.js';
import { extractUserId } from '../middleware/auth.js';

const router = Router();

/**
 * GET /api/accounts/status
 * Get connection status for Google and Discord accounts
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    const userId = extractUserId(req);
    const status = await chatService.getAccountStatus(userId);

    res.json(status);
  } catch (error: any) {
    console.error('Account status error:', error);
    res.status(500).json({
      error: 'Failed to get account status',
      message: error.message,
    });
  }
});

export default router;
