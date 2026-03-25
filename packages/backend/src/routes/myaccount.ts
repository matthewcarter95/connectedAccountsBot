// MyAccount API routes for Connected Accounts
import { Router, Request, Response } from 'express';
import axios from 'axios';

const router = Router();

/**
 * POST /api/myaccount/connect
 * Initiate Connected Account flow using MyAccount API
 */
router.post('/connect', async (req: Request, res: Response) => {
  try {
    const { connection, myAccountToken } = req.body;

    if (!connection) {
      res.status(400).json({ error: 'Connection name required' });
      return;
    }

    if (!myAccountToken) {
      res.status(400).json({ error: 'MyAccount token required' });
      return;
    }

    const domain = process.env.AUTH0_DOMAIN;
    const frontendUrl = process.env.FRONTEND_URL;

    console.log('Initiating Connected Account flow for:', connection);
    console.log('Using MyAccount token of length:', myAccountToken?.length);

    // Call Auth0 MyAccount API to initiate connected account
    const myAccountResponse = await axios.post(
      `https://${domain}/api/v2/me/connected-accounts`,
      {
        connection_id: connection,
        redirect_uri: `${frontendUrl}/myaccount-callback`,
      },
      {
        headers: {
          Authorization: `Bearer ${myAccountToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('MyAccount API response:', myAccountResponse.data);

    // Return the connect_uri for the frontend to redirect to
    res.json({
      authorizationUrl: myAccountResponse.data.connect_uri,
      authSession: myAccountResponse.data.auth_session,
    });
  } catch (error: any) {
    console.error('MyAccount connect error:', error.response?.data || error.message);
    res.status(500).json({
      error: 'Failed to initiate connected account',
      message: error.response?.data?.message || error.message,
      details: error.response?.data,
    });
  }
});

// Note: Callback handler is in myaccount-callback.ts as a public route

export default router;
