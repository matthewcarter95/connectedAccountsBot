// Refresh Token Storage Service
// Manages storage and retrieval of Auth0 refresh tokens for Federated Token Exchange
// Uses DynamoDB for production storage, with in-memory fallback for development
// Note: In production, consider encrypting tokens at rest using KMS

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  DeleteCommand,
} from '@aws-sdk/lib-dynamodb';

// Storage mode: 'dynamodb' (default) or 'memory' for local development
const STORAGE_MODE = process.env.REFRESH_TOKEN_STORAGE || 'dynamodb';

// DynamoDB table name - set via environment variable
const TABLE_NAME = process.env.DYNAMODB_REFRESH_TOKENS_TABLE || 'connected-accounts-refresh-tokens';

// In-memory storage for development (not persisted across restarts)
interface InMemoryToken {
  refreshToken: string;
  expiresAt?: string;
}
const memoryStore = new Map<string, InMemoryToken>();

// Initialize DynamoDB client (lazy initialization)
let docClient: DynamoDBDocumentClient | null = null;

function getDynamoClient(): DynamoDBDocumentClient {
  if (!docClient) {
    const dynamoClient = new DynamoDBClient({
      region: process.env.AWS_REGION || 'us-east-1',
    });
    docClient = DynamoDBDocumentClient.from(dynamoClient);
  }
  return docClient;
}

export class RefreshTokenService {
  private storageMode: string;

  constructor() {
    this.storageMode = STORAGE_MODE;
    console.log(`RefreshTokenService initialized with storage mode: ${this.storageMode}`);
  }

  /**
   * Store or update a user's Auth0 refresh token
   * Uses auth0UserId as the partition key for direct lookups
   */
  async saveRefreshToken(
    auth0UserId: string,
    refreshToken: string,
    expiresAt?: Date
  ): Promise<void> {
    if (this.storageMode === 'memory') {
      return this.saveRefreshTokenMemory(auth0UserId, refreshToken, expiresAt);
    }
    return this.saveRefreshTokenDynamo(auth0UserId, refreshToken, expiresAt);
  }

  private async saveRefreshTokenMemory(
    auth0UserId: string,
    refreshToken: string,
    expiresAt?: Date
  ): Promise<void> {
    memoryStore.set(auth0UserId, {
      refreshToken,
      expiresAt: expiresAt?.toISOString(),
    });
    console.log(`[Memory] Saved refresh token for user ${auth0UserId}`);
  }

  private async saveRefreshTokenDynamo(
    auth0UserId: string,
    refreshToken: string,
    expiresAt?: Date
  ): Promise<void> {
    const item: Record<string, any> = {
      auth0UserId, // Partition key
      refreshToken,
      updatedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };

    if (expiresAt) {
      item.expiresAt = expiresAt.toISOString();
      // Set TTL for automatic DynamoDB cleanup (Unix timestamp in seconds)
      item.ttl = Math.floor(expiresAt.getTime() / 1000);
    }

    try {
      await getDynamoClient().send(
        new PutCommand({
          TableName: TABLE_NAME,
          Item: item,
        })
      );
      console.log(`[DynamoDB] Saved refresh token for user ${auth0UserId}`);
    } catch (error: any) {
      console.error(`Failed to save refresh token for user ${auth0UserId}:`, error);
      throw new Error(`Failed to save refresh token: ${error.message}`);
    }
  }

  /**
   * Get a user's Auth0 refresh token
   */
  async getRefreshToken(auth0UserId: string): Promise<string | null> {
    if (this.storageMode === 'memory') {
      return this.getRefreshTokenMemory(auth0UserId);
    }
    return this.getRefreshTokenDynamo(auth0UserId);
  }

  private getRefreshTokenMemory(auth0UserId: string): string | null {
    const stored = memoryStore.get(auth0UserId);
    if (!stored) {
      console.log(`[Memory] No refresh token found for user ${auth0UserId}`);
      return null;
    }

    // Check if token is expired
    if (stored.expiresAt && new Date(stored.expiresAt) < new Date()) {
      console.log(`[Memory] Refresh token expired for user ${auth0UserId}`);
      memoryStore.delete(auth0UserId);
      return null;
    }

    return stored.refreshToken;
  }

  private async getRefreshTokenDynamo(auth0UserId: string): Promise<string | null> {
    try {
      const result = await getDynamoClient().send(
        new GetCommand({
          TableName: TABLE_NAME,
          Key: { auth0UserId },
        })
      );

      if (!result.Item) {
        console.log(`[DynamoDB] No refresh token found for user ${auth0UserId}`);
        return null;
      }

      const { refreshToken, expiresAt } = result.Item;

      // Check if token is expired (in case TTL hasn't cleaned it up yet)
      if (expiresAt && new Date(expiresAt) < new Date()) {
        console.log(`[DynamoDB] Refresh token expired for user ${auth0UserId}`);
        return null;
      }

      return refreshToken;
    } catch (error: any) {
      console.error(`Failed to get refresh token for user ${auth0UserId}:`, error);
      return null;
    }
  }

  /**
   * Delete a user's refresh token (e.g., on logout)
   */
  async deleteRefreshToken(auth0UserId: string): Promise<void> {
    if (this.storageMode === 'memory') {
      memoryStore.delete(auth0UserId);
      console.log(`[Memory] Deleted refresh token for user ${auth0UserId}`);
      return;
    }

    try {
      await getDynamoClient().send(
        new DeleteCommand({
          TableName: TABLE_NAME,
          Key: { auth0UserId },
        })
      );
      console.log(`[DynamoDB] Deleted refresh token for user ${auth0UserId}`);
    } catch (error: any) {
      console.error(`Failed to delete refresh token for user ${auth0UserId}:`, error);
    }
  }

  /**
   * Check if a user has a valid refresh token
   */
  async hasValidRefreshToken(auth0UserId: string): Promise<boolean> {
    const token = await this.getRefreshToken(auth0UserId);
    return token !== null;
  }
}

export const refreshTokenService = new RefreshTokenService();

/*
DynamoDB Table Setup:

Create the table with the following configuration:
- Table name: connected-accounts-refresh-tokens (or set via DYNAMODB_REFRESH_TOKENS_TABLE)
- Partition key: auth0UserId (String)
- Enable TTL on the 'ttl' attribute for automatic token expiration

AWS CLI command:
aws dynamodb create-table \
  --table-name connected-accounts-refresh-tokens \
  --attribute-definitions AttributeName=auth0UserId,AttributeType=S \
  --key-schema AttributeName=auth0UserId,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region us-east-1

aws dynamodb update-time-to-live \
  --table-name connected-accounts-refresh-tokens \
  --time-to-live-specification "Enabled=true, AttributeName=ttl" \
  --region us-east-1
*/
