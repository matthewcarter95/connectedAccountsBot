import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import { randomUUID } from 'crypto';
import { authService } from './authService.js';
import { llmService } from './llmService.js';
import { gmailService } from './gmailService.js';
import { discordService } from './discordService.js';
import { ChatResponse } from '../types/index.js';

const USERS_TABLE = process.env.DYNAMODB_USERS_TABLE || 'connected-accounts-users';
const MESSAGES_TABLE = process.env.DYNAMODB_CHAT_MESSAGES_TABLE || 'connected-accounts-chat-messages';

let docClient: DynamoDBDocumentClient | null = null;
function getClient() {
  if (!docClient) {
    docClient = DynamoDBDocumentClient.from(
      new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' })
    );
  }
  return docClient;
}

export class ChatService {
  async processMessage(auth0UserId: string, prompt: string): Promise<ChatResponse> {
    const startTime = Date.now();
    await this.ensureUser(auth0UserId);

    const messageId = randomUUID();
    const createdAt = new Date().toISOString();

    await getClient().send(new PutCommand({
      TableName: MESSAGES_TABLE,
      Item: { auth0UserId, messageId, prompt, status: 'processing', createdAt },
    }));

    try {
      const searchParams = await llmService.extractSearchParams(prompt);

      const googleToken = await authService.getGoogleToken(auth0UserId);
      if (!googleToken) throw new Error('Google account not connected');

      const emails = await gmailService.searchEmails(googleToken, searchParams);

      const discordToken = await authService.getDiscordToken(auth0UserId);
      if (!discordToken) throw new Error('Discord account not connected');

      const discordMessage = llmService.formatEmailsForDiscord(emails, prompt);
      const messageIds = await discordService.sendLongDM(discordToken, discordMessage);

      const processingTimeMs = Date.now() - startTime;

      await getClient().send(new UpdateCommand({
        TableName: MESSAGES_TABLE,
        Key: { auth0UserId, messageId },
        UpdateExpression: 'SET #s = :s, emailsFound = :ef, emailsSent = :es, discordMessageId = :dm, processingTimeMs = :pt',
        ExpressionAttributeNames: { '#s': 'status' },
        ExpressionAttributeValues: {
          ':s': 'completed',
          ':ef': emails.length,
          ':es': emails.length,
          ':dm': messageIds[0],
          ':pt': processingTimeMs,
        },
      }));

      return {
        emailsFound: emails.length,
        emailsSent: emails.length,
        discordMessageId: messageIds[0],
        metadata: { processingTimeMs },
      };
    } catch (error: any) {
      console.error('Chat processing failed:', error);
      await getClient().send(new UpdateCommand({
        TableName: MESSAGES_TABLE,
        Key: { auth0UserId, messageId },
        UpdateExpression: 'SET #s = :s, errorMessage = :e',
        ExpressionAttributeNames: { '#s': 'status' },
        ExpressionAttributeValues: { ':s': 'failed', ':e': error.message },
      }));
      throw error;
    }
  }

  async getChatHistory(auth0UserId: string, limit = 50) {
    const result = await getClient().send(new QueryCommand({
      TableName: MESSAGES_TABLE,
      KeyConditionExpression: 'auth0UserId = :uid',
      ExpressionAttributeValues: { ':uid': auth0UserId },
      ScanIndexForward: false,
      Limit: limit,
    }));
    return result.Items || [];
  }

  async getAccountStatus(auth0UserId: string) {
    const googleConnected = await authService.hasConnectedProvider(auth0UserId, 'google-oauth2');
    const discordConnected = await authService.hasConnectedProvider(auth0UserId, 'discord');

    let googleEmail: string | undefined;
    let discordUsername: string | undefined;

    if (googleConnected) {
      try {
        const token = await authService.getGoogleToken(auth0UserId);
        if (token) googleEmail = (await gmailService.getProfile(token)).email;
      } catch {}
    }

    if (discordConnected) {
      try {
        const token = await authService.getDiscordToken(auth0UserId);
        if (token) {
          const profile = await discordService.getCurrentUser(token);
          discordUsername = `${profile.username}#${profile.discriminator}`;
        }
      } catch {}
    }

    return {
      google: { connected: googleConnected, email: googleEmail },
      discord: { connected: discordConnected, username: discordUsername },
    };
  }

  private async ensureUser(auth0UserId: string): Promise<void> {
    const result = await getClient().send(new GetCommand({
      TableName: USERS_TABLE,
      Key: { auth0UserId },
    }));
    if (!result.Item) {
      await getClient().send(new PutCommand({
        TableName: USERS_TABLE,
        Item: { auth0UserId, createdAt: new Date().toISOString() },
        ConditionExpression: 'attribute_not_exists(auth0UserId)',
      })).catch(() => {}); // ignore if race-created
    }
  }
}

export const chatService = new ChatService();
