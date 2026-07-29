// DynamoDB-backed store for pending Connected Account flows.
// Reuses the connected-accounts-refresh-tokens table with a 'pending#' key prefix.
// Each record expires after 10 minutes via DynamoDB TTL.

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';

const TABLE_NAME = process.env.DYNAMODB_REFRESH_TOKENS_TABLE || 'connected-accounts-refresh-tokens';

let docClient: DynamoDBDocumentClient | null = null;
function getClient() {
  if (!docClient) {
    docClient = DynamoDBDocumentClient.from(new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' }));
  }
  return docClient;
}

export interface PendingConnect {
  authSession: string;
  connection: string;
  myAccountToken: string;
}

export async function savePendingConnect(state: string, data: PendingConnect): Promise<void> {
  const ttl = Math.floor(Date.now() / 1000) + 600; // 10 minutes
  await getClient().send(new PutCommand({
    TableName: TABLE_NAME,
    Item: { auth0UserId: `pending#${state}`, ...data, ttl },
  }));
}

export async function getPendingConnect(state: string): Promise<PendingConnect | null> {
  const result = await getClient().send(new GetCommand({
    TableName: TABLE_NAME,
    Key: { auth0UserId: `pending#${state}` },
  }));
  if (!result.Item) return null;
  const { authSession, connection, myAccountToken } = result.Item;
  return { authSession, connection, myAccountToken };
}

export async function deletePendingConnect(state: string): Promise<void> {
  await getClient().send(new DeleteCommand({
    TableName: TABLE_NAME,
    Key: { auth0UserId: `pending#${state}` },
  }));
}
