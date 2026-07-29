// Public callback handler for MyAccount Connected Accounts (no JWT required)
// Uses Auth0 MyAccount API v1 endpoint for completing the connection
// Reference: https://github.com/deepu105/auth0-token-vault-cli/tree/main/src/auth
import { Request, Response } from 'express';
import axios from 'axios';
import { getPendingConnect, deletePendingConnect } from '../lib/pendingConnects.js';

export async function handleMyAccountCallback(req: Request, res: Response): Promise<void> {
  try {
    const { connect_code, state, error, error_description } = req.query;

    // Handle OAuth errors from Auth0
    if (error) {
      console.error('MyAccount callback received error:', error, error_description);
      const errorMsg = error_description || error;
      res.redirect(`${process.env.FRONTEND_URL}?connect=error&message=${encodeURIComponent(String(errorMsg))}`);
      return;
    }

    if (!connect_code || !state) {
      console.error('MyAccount callback missing required parameters:', { connect_code: !!connect_code, state: !!state });
      res.redirect(`${process.env.FRONTEND_URL}?connect=error&message=missing_connect_code`);
      return;
    }

    // Look up auth_session + myAccountToken stored in DynamoDB during the connect call.
    const pending = await getPendingConnect(state as string);
    if (!pending) {
      console.error('MyAccount callback: no pending connect found for state', state);
      res.redirect(`${process.env.FRONTEND_URL}?connect=error&message=session_expired`);
      return;
    }
    await deletePendingConnect(state as string);
    const { authSession, connection, myAccountToken } = pending;

    const domain = process.env.AUTH0_DOMAIN;
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';
    const redirectUri = `${backendUrl}/api/myaccount/callback`;

    console.log('MyAccount callback - connect_code received, completing flow for connection:', connection);
    console.log('state:', state);

    const completeResponse = await axios.post(
      `https://${domain}/me/v1/connected-accounts/complete`,
      {
        connect_code: connect_code,
        auth_session: authSession,
        redirect_uri: redirectUri,
      },
      {
        headers: {
          Authorization: `Bearer ${myAccountToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('Connected account completed:', completeResponse.status, completeResponse.data);

    const { id, scopes } = completeResponse.data;
    console.log(`Successfully connected account: id=${id}, connection=${connection}, scopes=${scopes?.join(', ')}`);

    // Redirect back to frontend — the frontend's App.tsx watches for ?connect=success
    res.redirect(`${process.env.FRONTEND_URL}?connect=success&connection=${encodeURIComponent(connection || '')}`);
  } catch (error: any) {
    console.error('MyAccount callback error:', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      message: error.message,
    });
    const errorMsg = error.response?.data?.message || error.response?.data?.error_description || error.message;
    res.redirect(`${process.env.FRONTEND_URL}?connect=error&message=${encodeURIComponent(errorMsg)}`);
  }
}
