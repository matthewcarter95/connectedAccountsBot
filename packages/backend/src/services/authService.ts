// Auth0 token management service
// Supports both Management API (legacy) and Federated Token Exchange (preferred)
// Reference: https://github.com/deepu105/auth0-token-vault-cli/tree/main/src/auth
import axios from 'axios';
import { ConnectedAccountToken } from '../types/index.js';
import { tokenExchangeService, TokenExchangeError } from './tokenExchangeService.js';
import { refreshTokenService } from './refreshTokenService.js';

export class AuthService {
  private auth0Domain: string;
  private clientId: string;
  private clientSecret: string;
  private managementToken: string | null = null;
  private managementTokenExpiry: number = 0;

  // Feature flag: use Federated Token Exchange instead of Management API
  private useFederatedTokenExchange: boolean;

  constructor() {
    this.auth0Domain = process.env.AUTH0_DOMAIN!;
    this.clientId = process.env.AUTH0_API_CLIENT_ID!;
    this.clientSecret = process.env.AUTH0_API_CLIENT_SECRET!;
    // Enable Federated Token Exchange by default, can be disabled via env var
    this.useFederatedTokenExchange = process.env.USE_FEDERATED_TOKEN_EXCHANGE !== 'false';
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
   * Get user's connected account token using Federated Token Exchange
   * This is the preferred method as it gets fresh tokens directly from the IdP
   */
  private async getUserTokenViaFederatedExchange(
    auth0UserId: string,
    connection: string
  ): Promise<ConnectedAccountToken | null> {
    try {
      // Get the user's stored refresh token
      const refreshToken = await refreshTokenService.getRefreshToken(auth0UserId);

      if (!refreshToken) {
        console.log(`No refresh token found for user ${auth0UserId}, falling back to Management API`);
        return null;
      }

      // Exchange for connection-specific access token
      const result = await tokenExchangeService.exchangeForConnectionToken(
        refreshToken,
        connection,
        auth0UserId
      );

      const provider = connection === 'google-oauth2' ? 'google' : 'discord';

      return {
        provider,
        accessToken: result.accessToken,
        expiresAt: result.expiresAt,
      };
    } catch (error) {
      if (error instanceof TokenExchangeError) {
        console.error(`Federated Token Exchange failed for ${connection}:`, error.message, `(code: ${error.code})`);

        // If auth is required, the user needs to re-login with offline_access
        if (error.code === 'AUTH_REQUIRED') {
          console.log('User needs to re-authenticate with offline_access scope');
        }
        // If authz is required, the user needs to connect/re-connect the account
        if (error.code === 'AUTHZ_REQUIRED') {
          console.log('User needs to connect or re-authorize the account');
        }
      } else {
        console.error(`Unexpected error in Federated Token Exchange:`, error);
      }
      return null;
    }
  }

  /**
   * Get user's connected account token for a specific provider
   * Uses Federated Token Exchange if available, falls back to Management API
   */
  async getUserToken(
    auth0UserId: string,
    provider: 'google-oauth2' | 'discord'
  ): Promise<ConnectedAccountToken | null> {
    // Try Federated Token Exchange first if enabled
    if (this.useFederatedTokenExchange) {
      const connection = provider === 'discord' ? 'discord' : 'google-oauth2';
      const token = await this.getUserTokenViaFederatedExchange(auth0UserId, connection);
      if (token) {
        return token;
      }
      console.log(`Federated Token Exchange failed for ${provider}, falling back to Management API`);
    }

    // Fallback to Management API
    return this.getUserTokenViaManagementAPI(auth0UserId, provider);
  }

  /**
   * Get user's connected account token via Management API (legacy method)
   */
  private async getUserTokenViaManagementAPI(
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

      console.log(`Found ${provider} token for user via Management API`);
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

  /**
   * Store refresh token for a user (call this after initial login)
   */
  async storeRefreshToken(auth0UserId: string, refreshToken: string, expiresAt?: Date): Promise<void> {
    await refreshTokenService.saveRefreshToken(auth0UserId, refreshToken, expiresAt);
  }

  /**
   * Clear cached tokens for a user (call on logout)
   */
  async clearUserTokens(auth0UserId: string): Promise<void> {
    await refreshTokenService.deleteRefreshToken(auth0UserId);
    tokenExchangeService.clearCache(auth0UserId);
  }
}

export const authService = new AuthService();
