// MyAccount API routes for Connected Accounts
// Uses Auth0 MyAccount API v1 endpoints for Connected Accounts flow
// Reference: https://github.com/deepu105/auth0-token-vault-cli/tree/main/src/auth
import { Router, Request, Response } from 'express';
import axios from 'axios';

const router = Router();

/**
 * POST /api/myaccount/connect
 * Initiate Connected Account flow using MyAccount API v1
 *
 * The MyAccount API v1 endpoint is: /me/v1/connected-accounts/connect
 * It expects: connection (string), redirect_uri (string), state (optional), scopes (optional array)
 */
router.post('/connect', async (req: Request, res: Response) => {
  try {
    const { connection, myAccountToken, scopes } = req.body;

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
    // Use the correct MyAccount API v1 endpoint
    const url = `https://${domain}/me/v1/connected-accounts/connect`;
    const redirectUri = `${frontendUrl}/myaccount-callback`;

    // Generate a state parameter for CSRF protection
    const state = crypto.randomUUID();

    const requestBody: Record<string, any> = {
      connection: connection,
      redirect_uri: redirectUri,
      state: state,
    };

    // Only include scopes if provided and non-empty (API rejects empty array)
    if (scopes && Array.isArray(scopes) && scopes.length > 0) {
      requestBody.scopes = scopes;
    }

    console.log('Initiating Connected Account flow for:', connection);
    console.log('Using MyAccount token of length:', myAccountToken?.length);
    console.log('Making POST request to:', url);
    console.log('Request body:', JSON.stringify(requestBody, null, 2));

    // Call Auth0 MyAccount API v1 to initiate connected account
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

    const { connect_uri, auth_session, expires_in, connect_params } = myAccountResponse.data;

    // Build the full connect URL with ticket if provided
    let fullConnectUri = connect_uri;
    if (connect_params?.ticket) {
      const connectUrl = new URL(connect_uri);
      connectUrl.searchParams.set('ticket', connect_params.ticket);
      fullConnectUri = connectUrl.toString();
    }

    // Return the connect_uri for the frontend to redirect to
    res.json({
      authorizationUrl: fullConnectUri,
      authSession: auth_session,
      state: state,
      expiresIn: expires_in,
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
