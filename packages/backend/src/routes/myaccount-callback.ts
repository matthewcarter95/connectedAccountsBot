// Public callback handler for MyAccount Connected Accounts (no JWT required)
// Uses Auth0 MyAccount API v1 endpoint for completing the connection
// Reference: https://github.com/deepu105/auth0-token-vault-cli/tree/main/src/auth
import { Request, Response } from 'express';
import axios from 'axios';

export async function handleMyAccountCallback(req: Request, res: Response): Promise<void> {
  try {
    const { connect_code, auth_session, state, error, error_description } = req.query;

    // Handle OAuth errors from Auth0
    if (error) {
      console.error('MyAccount callback received error:', error, error_description);
      const errorMsg = error_description || error;
      res.redirect(`${process.env.FRONTEND_URL}?connect=error&message=${encodeURIComponent(String(errorMsg))}`);
      return;
    }

    if (!connect_code || !auth_session) {
      console.error('MyAccount callback missing required parameters:', { connect_code: !!connect_code, auth_session: !!auth_session });
      res.redirect(`${process.env.FRONTEND_URL}?error=missing_connect_code`);
      return;
    }

    const domain = process.env.AUTH0_DOMAIN;
    const frontendUrl = process.env.FRONTEND_URL;
    const redirectUri = `${frontendUrl}/myaccount-callback`;

    console.log('MyAccount callback - connect_code:', connect_code);
    console.log('auth_session:', auth_session);
    console.log('state:', state);

    // Complete the connected account using MyAccount API v1 endpoint
    // Note: The complete endpoint requires a MyAccount token with appropriate scopes
    // Since this is a public callback, we need to use the auth_session which was
    // created during the initiate phase and contains the necessary authorization
    const completeResponse = await axios.post(
      `https://${domain}/me/v1/connected-accounts/complete`,
      {
        connect_code: connect_code,
        auth_session: auth_session,
        redirect_uri: redirectUri,
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('Connected account completed:', completeResponse.status, completeResponse.data);

    const { id, connection, scopes } = completeResponse.data;
    console.log(`Successfully connected account: id=${id}, connection=${connection}, scopes=${scopes?.join(', ')}`);

    // Redirect back to frontend with success
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
