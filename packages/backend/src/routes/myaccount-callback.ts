// Public callback handler for MyAccount Connected Accounts (no JWT required)
import { Request, Response } from 'express';
import axios from 'axios';

export async function handleMyAccountCallback(req: Request, res: Response): Promise<void> {
  try {
    const { connect_code, auth_session } = req.query;

    if (!connect_code || !auth_session) {
      return res.redirect(`${process.env.FRONTEND_URL}?error=missing_connect_code`);
    }

    const domain = process.env.AUTH0_DOMAIN;

    console.log('MyAccount callback - connect_code:', connect_code);
    console.log('auth_session:', auth_session);

    // Complete the connected account by posting back to MyAccount API
    const completeResponse = await axios.post(
      `https://${domain}/api/v2/me/connected-accounts`,
      {
        connect_code: connect_code,
        auth_session: auth_session,
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('Connected account completed:', completeResponse.status, completeResponse.data);

    // Redirect back to frontend with success
    res.redirect(`${process.env.FRONTEND_URL}?connect=success`);
  } catch (error: any) {
    console.error('MyAccount callback error:', error.response?.data || error.message);
    res.redirect(`${process.env.FRONTEND_URL}?connect=error&message=${encodeURIComponent(error.message)}`);
  }
}
