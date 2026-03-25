// Auth0 token management service
import axios from 'axios';
import { ConnectedAccountToken } from '../types/index.js';

export class AuthService {
  private auth0Domain: string;
  private clientId: string;
  private clientSecret: string;
  private managementToken: string | null = null;
  private managementTokenExpiry: number = 0;

  constructor() {
    this.auth0Domain = process.env.AUTH0_DOMAIN!;
    this.clientId = process.env.AUTH0_API_CLIENT_ID!;
    this.clientSecret = process.env.AUTH0_API_CLIENT_SECRET!;
  }

  /**
   * Get Auth0 Management API token
   */
  private async getManagementToken(): Promise<string> {
    // Return cached token if still valid
    if (this.managementToken && Date.now() < this.managementTokenExpiry) {
      return this.managementToken;
    }

    const response = await axios.post(
      `https://${this.auth0Domain}/oauth/token`,
      {
        grant_type: 'client_credentials',
        client_id: this.clientId,
        client_secret: this.clientSecret,
        audience: `https://${this.auth0Domain}/api/v2/`,
      }
    );

    this.managementToken = response.data.access_token;
    // Set expiry to 5 minutes before actual expiry
    this.managementTokenExpiry = Date.now() + (response.data.expires_in - 300) * 1000;

    return this.managementToken!;
  }

  /**
   * Get user's connected account token for a specific provider
   */
  async getUserToken(
    auth0UserId: string,
    provider: 'google-oauth2' | 'discord'
  ): Promise<ConnectedAccountToken | null> {
    try {
      const managementToken = await this.getManagementToken();

      // Get user's identities
      const response = await axios.get(
        `https://${this.auth0Domain}/api/v2/users/${encodeURIComponent(auth0UserId)}`,
        {
          headers: {
            Authorization: `Bearer ${managementToken}`,
          },
        }
      );

      const identities = response.data.identities || [];
      console.log(`User ${auth0UserId} has ${identities.length} identities:`, identities.map((i: any) => i.provider));

      // For Discord, the provider is stored as 'oauth2', not 'discord'
      const searchProvider = provider === 'discord' ? 'oauth2' : provider;
      const identity = identities.find((i: any) => i.provider === searchProvider);

      if (!identity) {
        console.log(`No ${provider} (searching for ${searchProvider}) identity found`);
        return null;
      }

      console.log(`Found identity for ${provider}:`, {
        provider: identity.provider,
        connection: identity.connection,
        isSocial: identity.isSocial,
        hasAccessToken: !!identity.access_token,
        accessTokenLength: identity.access_token?.length,
      });

      if (!identity.access_token) {
        console.log(`No access_token found in ${provider} identity`);
        return null;
      }

      console.log(`Found ${provider} token for user`);
      return {
        provider: provider === 'google-oauth2' ? 'google' : 'discord',
        accessToken: identity.access_token,
        refreshToken: identity.refresh_token,
      };
    } catch (error: any) {
      console.error(`Failed to get ${provider} token for user ${auth0UserId}:`, error.response?.data || error.message);
      return null;
    }
  }

  /**
   * Get Google OAuth token for user
   */
  async getGoogleToken(auth0UserId: string): Promise<string | null> {
    const token = await this.getUserToken(auth0UserId, 'google-oauth2');
    return token?.accessToken || null;
  }

  /**
   * Get Discord OAuth token for user
   */
  async getDiscordToken(auth0UserId: string): Promise<string | null> {
    const token = await this.getUserToken(auth0UserId, 'discord');
    return token?.accessToken || null;
  }

  /**
   * Check if user has connected a specific provider
   */
  async hasConnectedProvider(
    auth0UserId: string,
    provider: 'google-oauth2' | 'discord'
  ): Promise<boolean> {
    const token = await this.getUserToken(auth0UserId, provider);
    return token !== null;
  }

  /**
   * Link a secondary account to primary user
   */
  async linkAccount(
    primaryUserId: string,
    secondaryUserId: string
  ): Promise<void> {
    try {
      const managementToken = await this.getManagementToken();

      // Parse the secondary user ID
      // Format can be: "auth0|123", "google-oauth2|123", or "oauth2|discord|123"
      const parts = secondaryUserId.split('|');
      let provider: string;
      let userId: string;

      if (parts.length === 3 && parts[0] === 'oauth2') {
        // Special case for oauth2|provider|id (Discord, etc.)
        provider = parts[1]; // "discord"
        userId = parts[2];   // "753948477481812038"
      } else {
        // Standard case: provider|id
        provider = parts[0];
        userId = parts[1];
      }

      console.log(`Linking: provider=${provider}, user_id=${userId} to primary user ${primaryUserId}`);

      await axios.post(
        `https://${this.auth0Domain}/api/v2/users/${encodeURIComponent(primaryUserId)}/identities`,
        {
          provider: provider,
          user_id: userId,
        },
        {
          headers: {
            Authorization: `Bearer ${managementToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      console.log(`Successfully linked ${secondaryUserId} to ${primaryUserId}`);
    } catch (error: any) {
      console.error('Failed to link accounts:', error.response?.data || error);
      throw new Error(`Account linking failed: ${error.response?.data?.message || error.message}`);
    }
  }
}

export const authService = new AuthService();
