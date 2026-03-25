// Chat routes
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { chatService } from '../services/chatService.js';
import { extractUserId } from '../middleware/auth.js';

const router = Router();

// Request validation schema
const chatMessageSchema = z.object({
  prompt: z.string().min(1).max(500),
});

/**
 * POST /api/chat/message
 * Process a chat message and search Gmail
 */
router.post('/message', async (req: Request, res: Response) => {
  try {
    // Validate request body
    const validation = chatMessageSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid request',
        details: validation.error.errors,
      });
    }

    const { prompt } = validation.data;
    const userId = extractUserId(req);

    // Process the message
    const result = await chatService.processMessage(userId, prompt);

    res.json(result);
  } catch (error: any) {
    console.error('Chat message error:', error);

    if (error.message.includes('not connected')) {
      return res.status(400).json({
        error: 'Account not connected',
        message: error.message,
      });
    }

    res.status(500).json({
      error: 'Failed to process message',
      message: error.message,
    });
  }
});

/**
 * GET /api/chat/history
 * Get chat history for the current user
 */
router.get('/history', async (req: Request, res: Response) => {
  try {
    const userId = extractUserId(req);
    const limit = parseInt(req.query.limit as string) || 50;

    const history = await chatService.getChatHistory(userId, limit);

    res.json(history);
  } catch (error: any) {
    console.error('Chat history error:', error);
    res.status(500).json({
      error: 'Failed to get chat history',
      message: error.message,
    });
  }
});

export default router;
