// Federated Token Exchange Service
// Exchanges Auth0 refresh tokens for IdP access tokens (Google, Discord)
// Based on: https://github.com/deepu105/auth0-token-vault-cli/tree/main/src/auth

import axios from 'axios';

// Auth0 Federated Token Exchange constants
const GRANT_TYPE = 'urn:auth0:params:oauth:grant-type:token-exchange:federated-connection-access-token';
const SUBJECT_TOKEN_TYPE = 'urn:ietf:params:oauth:token-type:refresh_token';
const REQUESTED_TOKEN_TYPE = 'http://auth0.com/oauth/token-type/federated-connection-access-token';

// MyAccount API constants
const MY_ACCOUNT_SCOPES = 'create:me:connected_accounts read:me:connected_accounts delete:me:connected_accounts';

export interface TokenExchangeResult {
  accessToken: string;
  expiresAt: number;
  scopes: string[];
}

export interface ConnectedAccountInfo {
  id: string;
  connection: string;
  scopes: string[];
}

export class TokenExchangeError extends Error {
  constructor(
    message: string,
    public readonly code: 'AUTH_REQUIRED' | 'AUTHZ_REQUIRED' | 'SERVICE_ERROR'
  ) {
    super(message);
    this.name = 'TokenExchangeError';
  }
}

// In-memory token cache (consider Redis for production)
interface CachedToken {
  accessToken: string;
  expiresAt: number;
  scopes: string[];
}

const tokenCache = new Map<string, CachedToken>();

function getCacheKey(userId: string, connection: string): string {
  return `${userId}:${connection}`;
}

export class TokenExchangeService {
  private auth0Domain: string;
  private clientId: string;
  private clientSecret: string;

  constructor() {
    this.auth0Domain = process.env.AUTH0_DOMAIN!;
    this.clientId = process.env.AUTH0_API_CLIENT_ID!;
    this.clientSecret = process.env.AUTH0_API_CLIENT_SECRET!;
  }

  /**
   * Exchange Auth0 refresh token for a federated connection access token (e.g., Google, Discord)
   * This is the core Federated Token Exchange flow.
   *
   * @param refreshToken - User's Auth0 refresh token
   * @param connection - Connection name (e.g., 'google-oauth2', 'discord')
   * @param userId - User ID for caching purposes
   * @param requiredScopes - Optional scopes to validate on the returned token
   */
  async exchangeForConnectionToken(
    refreshToken: string,
    connection: string,
    userId: string,
    requiredScopes?: string[]
  ): Promise<TokenExchangeResult> {
    const cacheKey = getCacheKey(userId, connection);

    // Check cache first
    const cached = tokenCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now() + 60000) { // 1 min buffer
      // Validate required scopes if specified
      if (requiredScopes?.length) {
        const missingScopes = requiredScopes.filter(s => !cached.scopes.includes(s));
        if (missingScopes.length === 0) {
          console.log(`Using cached token for ${connection} (scopes validated)`);
          return cached;
        }
        console.log(`Cached token missing scopes: ${missingScopes.join(', ')} - re-exchanging`);
      } else {
        console.log(`Using cached token for ${connection}`);
        return cached;
      }
    }

    if (!refreshToken) {
      throw new TokenExchangeError(
        'No refresh token available. User must re-authenticate with offline_access scope.',
        'AUTH_REQUIRED'
      );
    }

    console.log(`Exchanging token for connection ${connection}`);

    try {
      const response = await axios.post(
        `https://${this.auth0Domain}/oauth/token`,
        {
          grant_type: GRANT_TYPE,
          client_id: this.clientId,
          client_secret: this.clientSecret,
          subject_token: refreshToken,
          subject_token_type: SUBJECT_TOKEN_TYPE,
          requested_token_type: REQUESTED_TOKEN_TYPE,
          connection: connection,
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      const { access_token, expires_in, scope } = response.data;
      const grantedScopes = scope ? scope.split(' ') : [];

      // Validate required scopes if specified
      if (requiredScopes?.length) {
        const missingScopes = requiredScopes.filter(s => !grantedScopes.includes(s));
        if (missingScopes.length > 0) {
          throw new TokenExchangeError(
            `Insufficient scopes for ${connection}. Missing: ${missingScopes.join(', ')}. User must re-authorize.`,
            'AUTHZ_REQUIRED'
          );
        }
      }

      const result: TokenExchangeResult = {
        accessToken: access_token,
        expiresAt: Date.now() + (expires_in ?? 3600) * 1000,
        scopes: grantedScopes,
      };

      // Cache the token
      tokenCache.set(cacheKey, result);
      console.log(`Token exchange successful for ${connection}, expires in ${expires_in}s`);

      return result;
    } catch (error: any) {
      const errCode = error.response?.data?.error;
      const errDesc = error.response?.data?.error_description || error.message;

      console.error(`Token exchange failed: ${errCode} - ${errDesc}`);

      // Map error codes to appropriate exceptions
      if (errCode === 'unauthorized_client' || errCode === 'access_denied') {
        throw new TokenExchangeError(
          `Connection ${connection} not authorized. User must connect the account first.`,
          'AUTHZ_REQUIRED'
        );
      }
      if (errCode === 'invalid_grant' || errCode === 'expired_token') {
        throw new TokenExchangeError(
          'Session expired. User must re-authenticate.',
          'AUTH_REQUIRED'
        );
      }
      if (errCode === 'federated_connection_refresh_token_flow_failed') {
        throw new TokenExchangeError(
          `Connection ${connection} token refresh failed. User must re-authorize the connection.`,
          'AUTHZ_REQUIRED'
        );
      }

      throw new TokenExchangeError(`Token exchange failed: ${errDesc}`, 'SERVICE_ERROR');
    }
  }

  /**
   * Get a MyAccount API access token by exchanging the user's refresh token
   * with the MRRT (Multi-Resource Refresh Token) audience.
   */
  async getMyAccountToken(refreshToken: string): Promise<string> {
    const audience = `https://${this.auth0Domain}/me/`;

    console.log(`Requesting MyAccount API token with audience ${audience}`);

    try {
      const response = await axios.post(
        `https://${this.auth0Domain}/oauth/token`,
        {
          grant_type: 'refresh_token',
          client_id: this.clientId,
          client_secret: this.clientSecret,
          refresh_token: refreshToken,
          audience: audience,
          scope: MY_ACCOUNT_SCOPES,
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      return response.data.access_token;
    } catch (error: any) {
      console.error('Failed to get MyAccount token:', error.response?.data || error.message);
      throw new TokenExchangeError(
        `Failed to get MyAccount token: ${error.response?.data?.error_description || error.message}`,
        'AUTH_REQUIRED'
      );
    }
  }

  /**
   * Initiate a Connected Account link via the MyAccount API.
   * Returns the connect_uri to redirect the user to and the auth_session for completion.
   */
  async initiateConnect(
    myAccountToken: string,
    connection: string,
    redirectUri: string,
    scopes: string[] = [],
    state?: string
  ): Promise<{ connectUri: string; authSession: string; expiresIn: number }> {
    console.log(`Initiating connected account for ${connection}`);

    try {
      const response = await axios.post(
        `https://${this.auth0Domain}/me/v1/connected-accounts/connect`,
        {
          connection,
          redirect_uri: redirectUri,
          state: state || crypto.randomUUID(),
          // Only include scopes when non-empty - the API rejects an empty array
          ...(scopes.length > 0 ? { scopes } : {}),
        },
        {
          headers: {
            Authorization: `Bearer ${myAccountToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const { connect_uri, auth_session, expires_in, connect_params } = response.data;

      // Build the full connect URL with ticket if provided
      let fullConnectUri = connect_uri;
      if (connect_params?.ticket) {
        const url = new URL(connect_uri);
        url.searchParams.set('ticket', connect_params.ticket);
        fullConnectUri = url.toString();
      }

      return {
        connectUri: fullConnectUri,
        authSession: auth_session,
        expiresIn: expires_in,
      };
    } catch (error: any) {
      console.error('Failed to initiate connect:', error.response?.data || error.message);
      throw new Error(
        `Failed to initiate connected account: ${error.response?.data?.message || error.message}`
      );
    }
  }

  /**
   * Complete a Connected Account link after the user has authorized.
   */
  async completeConnect(
    myAccountToken: string,
    authSession: string,
    connectCode: string,
    redirectUri: string
  ): Promise<ConnectedAccountInfo> {
    console.log('Completing connected account link');

    try {
      const response = await axios.post(
        `https://${this.auth0Domain}/me/v1/connected-accounts/complete`,
        {
          auth_session: authSession,
          connect_code: connectCode,
          redirect_uri: redirectUri,
        },
        {
          headers: {
            Authorization: `Bearer ${myAccountToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const { id, connection, scopes } = response.data;

      return { id, connection, scopes: scopes || [] };
    } catch (error: any) {
      console.error('Failed to complete connect:', error.response?.data || error.message);
      throw new Error(
        `Failed to complete connected account: ${error.response?.data?.message || error.message}`
      );
    }
  }

  /**
   * List connected accounts for the current user.
   */
  async listConnectedAccounts(myAccountToken: string): Promise<ConnectedAccountInfo[]> {
    try {
      const response = await axios.get(
        `https://${this.auth0Domain}/me/v1/connected-accounts/accounts`,
        {
          headers: {
            Authorization: `Bearer ${myAccountToken}`,
          },
        }
      );

      return response.data.accounts || [];
    } catch (error: any) {
      console.error('Failed to list connected accounts:', error.response?.data || error.message);
      throw new Error(
        `Failed to list connected accounts: ${error.response?.data?.message || error.message}`
      );
    }
  }

  /**
   * Delete a connected account by ID.
   */
  async deleteConnectedAccount(myAccountToken: string, accountId: string): Promise<void> {
    try {
      await axios.delete(
        `https://${this.auth0Domain}/me/v1/connected-accounts/accounts/${accountId}`,
        {
          headers: {
            Authorization: `Bearer ${myAccountToken}`,
          },
        }
      );
    } catch (error: any) {
      console.error('Failed to delete connected account:', error.response?.data || error.message);
      throw new Error(
        `Failed to delete connected account: ${error.response?.data?.message || error.message}`
      );
    }
  }

  /**
   * Clear cached token for a user/connection
   */
  clearCache(userId: string, connection?: string): void {
    if (connection) {
      tokenCache.delete(getCacheKey(userId, connection));
    } else {
      // Clear all tokens for user
      for (const key of tokenCache.keys()) {
        if (key.startsWith(`${userId}:`)) {
          tokenCache.delete(key);
        }
      }
    }
  }
}

export const tokenExchangeService = new TokenExchangeService();
