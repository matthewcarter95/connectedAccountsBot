// MyAccount API routes for Connected Accounts
// BFF version: backend fetches the MyAccount token from the stored refresh token.
// The frontend no longer needs to obtain or pass a MyAccount token.
import { Router, Request, Response } from 'express';
import axios from 'axios';
import { randomUUID } from 'crypto';
import { extractUserId } from '../middleware/auth.js';
import { savePendingConnect } from '../lib/pendingConnects.js';
import { refreshTokenService } from '../services/refreshTokenService.js';

const router = Router();

/**
 * POST /api/myaccount/connect
 * Initiate the Connected Account flow for a given connection (e.g. 'discord', 'google-oauth2').
 * Returns an authorizationUrl for the frontend to redirect the user to.
 */
router.post('/connect', async (req: Request, res: Response) => {
  try {
    const { connection, scopes } = req.body;
    const userId = extractUserId(req);

    if (!connection) {
      res.status(400).json({ error: 'Connection name required' });
      return;
    }

    // Fetch the user's stored refresh token and exchange it for a MyAccount API token
    const refreshToken = await refreshTokenService.getRefreshToken(userId);
    if (!refreshToken) {
      res.status(401).json({ error: 'No refresh token on file — please log out and log back in.' });
      return;
    }

    const domain = process.env.AUTH0_DOMAIN!;
    const myAccountAudience = `https://${domain}/me/`;

    const tokenResponse = await axios.post(`https://${domain}/oauth/token`, {
      grant_type: 'refresh_token',
      client_id: process.env.AUTH0_BFF_CLIENT_ID,
      client_secret: process.env.AUTH0_BFF_CLIENT_SECRET,
      refresh_token: refreshToken,
      audience: myAccountAudience,
      scope: 'openid create:me:connected_accounts read:me:connected_accounts',
    });

    const myAccountToken: string = tokenResponse.data.access_token;

    // If Auth0 issued a new refresh token (rotation), update stored token
    if (tokenResponse.data.refresh_token) {
      await refreshTokenService.saveRefreshToken(userId, tokenResponse.data.refresh_token);
    }

    const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';
    const redirectUri = `${backendUrl}/api/myaccount/callback`;
    const state = randomUUID();

    const requestBody: Record<string, any> = {
      connection,
      redirect_uri: redirectUri,
      state,
    };
    if (scopes && Array.isArray(scopes) && scopes.length > 0) {
      requestBody.scopes = scopes;
    }

    console.log('Initiating Connected Account flow for:', connection, 'user:', userId);

    const myAccountResponse = await axios.post(
      `https://${domain}/me/v1/connected-accounts/connect`,
      requestBody,
      { headers: { Authorization: `Bearer ${myAccountToken}`, 'Content-Type': 'application/json' } }
    );

    const { connect_uri, auth_session, expires_in, connect_params } = myAccountResponse.data;

    let fullConnectUri = connect_uri;
    if (connect_params?.ticket) {
      const url = new URL(connect_uri);
      url.searchParams.set('ticket', connect_params.ticket);
      fullConnectUri = url.toString();
    }

    // Store auth_session + myAccountToken in DynamoDB — retrieved at callback time
    await savePendingConnect(state, { authSession: auth_session, connection, myAccountToken });
    console.log(`Stored pending connect for state ${state}`);

    res.json({ authorizationUrl: fullConnectUri, state, expiresIn: expires_in });
  } catch (error: any) {
    console.error('MyAccount connect error:', {
      status: error.response?.status,
      data: error.response?.data,
      message: error.message,
    });
    res.status(500).json({
      error: 'Failed to initiate connected account',
      message: error.response?.data?.message || error.message,
    });
  }
});

export default router;
