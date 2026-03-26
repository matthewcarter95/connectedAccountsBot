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
    const url = `https://${domain}/me/connected-accounts`;

    const requestBody = {
      connection_id: connection,
      redirect_uri: `${frontendUrl}/myaccount-callback`,
    };

    console.log('Initiating Connected Account flow for:', connection);
    console.log('Using MyAccount token of length:', myAccountToken?.length);
    console.log('Making POST request to:', url);
    console.log('Request body:', JSON.stringify(requestBody, null, 2));

    // Call Auth0 MyAccount API to initiate connected account
    const myAccountResponse = await axios.post(
      url,
      requestBody,
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
    console.error('MyAccount connect error:', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      message: error.message,
    });
    res.status(500).json({
      error: 'Failed to initiate connected account',
      message: error.response?.data?.message || error.message,
      details: error.response?.data,
    });
  }
});

// Note: Callback handler is in myaccount-callback.ts as a public route

export default router;
