// Public callback handler for account linking (no JWT required)
import { Request, Response } from 'express';
import axios from 'axios';
import { authService } from '../services/authService.js';

export async function handleLinkCallback(req: Request, res: Response) {
  try {
    const { code, state } = req.query;

    if (!code || !state) {
      return res.redirect(`${process.env.FRONTEND_URL}?error=missing_code_or_state`);
    }

    // Decode state to get user info
    const stateData = JSON.parse(Buffer.from(state as string, 'base64url').toString());
    const { userId: primaryUserId, connection } = stateData;

    console.log('Link callback - primaryUserId:', primaryUserId, 'connection:', connection);

    // Exchange code for tokens - Note: SPA apps don't use client_secret
    const backendCallbackUrl = `${process.env.FRONTEND_URL!.replace('3000', '3001')}/api/myaccount/link-callback`;

    const tokenResponse = await axios.post(
      `https://${process.env.AUTH0_DOMAIN}/oauth/token`,
      {
        grant_type: 'authorization_code',
        client_id: process.env.AUTH0_SPA_CLIENT_ID,
        code,
        redirect_uri: backendCallbackUrl,
      }
    );

    console.log('Token exchange successful');

    // Get the secondary user ID
    const userInfoResponse = await axios.get(
      `https://${process.env.AUTH0_DOMAIN}/userinfo`,
      {
        headers: {
          Authorization: `Bearer ${tokenResponse.data.access_token}`,
        },
      }
    );

    const secondaryUserId = userInfoResponse.data.sub;
    console.log('Secondary user ID:', secondaryUserId);
    console.log('Primary user ID:', primaryUserId);

    // Link the accounts if they're different
    if (secondaryUserId !== primaryUserId) {
      console.log('Linking accounts...');

      // First, get the management token
      const managementToken = await axios.post(
        `https://${process.env.AUTH0_DOMAIN}/oauth/token`,
        {
          grant_type: 'client_credentials',
          client_id: process.env.AUTH0_API_CLIENT_ID,
          client_secret: process.env.AUTH0_API_CLIENT_SECRET,
          audience: `https://${process.env.AUTH0_DOMAIN}/api/v2/`,
        }
      );

      // Parse the secondary user ID for provider and user_id
      // Format: "oauth2|discord|753948477481812038"
      const parts = secondaryUserId.split('|');
      let provider: string;
      let userId: string;

      if (parts.length === 3 && parts[0] === 'oauth2') {
        // For oauth2 connections, use the full format: provider="oauth2", user_id="discord|753948477481812038"
        provider = 'oauth2';
        userId = `${parts[1]}|${parts[2]}`; // "discord|753948477481812038"
      } else {
        // Standard format: "auth0|123" or "google-oauth2|123"
        provider = parts[0];
        userId = parts[1];
      }

      console.log(`Linking provider=${provider}, user_id=${userId}`);

      // Link using Management API - simple payload
      const linkPayload = {
        provider: provider,
        user_id: userId,
      };

      console.log('Link payload:', JSON.stringify(linkPayload));

      try {
        const linkResponse = await axios.post(
          `https://${process.env.AUTH0_DOMAIN}/api/v2/users/${encodeURIComponent(primaryUserId)}/identities`,
          linkPayload,
          {
            headers: {
              Authorization: `Bearer ${managementToken.data.access_token}`,
              'Content-Type': 'application/json',
            },
          }
        );
        console.log('Link response:', linkResponse.data);
      } catch (linkError: any) {
        console.error('Link API error:', linkError.response?.data || linkError.message);

        // Try alternate approach: link with secondary user's token
        console.log('Trying alternate linking method with link_with parameter...');
        await axios.post(
          `https://${process.env.AUTH0_DOMAIN}/api/v2/users/${encodeURIComponent(primaryUserId)}/identities`,
          {
            link_with: tokenResponse.data.access_token,
          },
          {
            headers: {
              Authorization: `Bearer ${managementToken.data.access_token}`,
              'Content-Type': 'application/json',
            },
          }
        );
        console.log('Alternate linking method succeeded');
      }

      console.log('Accounts linked successfully');
    } else {
      console.log('User IDs are the same, no linking needed');
    }

    // Redirect back to frontend with success
    res.redirect(`${process.env.FRONTEND_URL}?link=success&connection=${connection}`);
  } catch (error: any) {
    console.error('Link callback error:', error.response?.data || error);
    res.redirect(`${process.env.FRONTEND_URL}?link=error&message=${encodeURIComponent(error.message)}`);
  }
}
