// Type definitions for Connected Accounts Bot

export interface Auth0User {
  sub: string;
  email: string;
  name?: string;
}

export interface Auth0Token {
  access_token: string;
  token_type: string;
  expires_in: number;
}

export interface ConnectedAccountToken {
  provider: 'google' | 'discord';
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
}

export interface GmailSearchParams {
  query: string;
  dateRange?: {
    start?: string; // YYYY-MM-DD
    end?: string;   // YYYY-MM-DD
  };
  from?: string;
  subject?: string;
  maxResults?: number;
}

export interface EmailResult {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  date: string;
  snippet: string;
}

export interface LLMExtractionResult {
  query: string;
  dateRange?: {
    start?: string;
    end?: string;
  };
  from?: string;
  subject?: string;
}

export interface ChatResponse {
  emailsFound: number;
  emailsSent: number;
  discordMessageId?: string;
  metadata: {
    processingTimeMs: number;
    tokensUsed?: number;
  };
}

export interface DiscordUser {
  id: string;
  username: string;
  discriminator: string;
}

export interface AccountStatus {
  google: {
    connected: boolean;
    email?: string;
  };
  discord: {
    connected: boolean;
    username?: string;
  };
}
