// Gmail API service for searching emails
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { GmailSearchParams, EmailResult } from '../types/index.js';

export class GmailService {
  /**
   * Create Gmail client with user's OAuth token
   */
  private createGmailClient(accessToken: string) {
    const oauth2Client = new OAuth2Client();
    oauth2Client.setCredentials({ access_token: accessToken });

    return google.gmail({ version: 'v1', auth: oauth2Client });
  }

  /**
   * Build Gmail search query from parameters
   */
  private buildSearchQuery(params: GmailSearchParams): string {
    const parts: string[] = [];

    // Add main query
    if (params.query) {
      parts.push(params.query);
    }

    // Add date range
    if (params.dateRange?.start) {
      parts.push(`after:${params.dateRange.start.replace(/-/g, '/')}`);
    }
    if (params.dateRange?.end) {
      parts.push(`before:${params.dateRange.end.replace(/-/g, '/')}`);
    }

    // Add from filter
    if (params.from) {
      parts.push(`from:${params.from}`);
    }

    // Add subject filter
    if (params.subject) {
      parts.push(`subject:${params.subject}`);
    }

    return parts.join(' ');
  }

  /**
   * Search Gmail for emails matching parameters
   */
  async searchEmails(
    accessToken: string,
    params: GmailSearchParams
  ): Promise<EmailResult[]> {
    try {
      const gmail = this.createGmailClient(accessToken);
      const query = this.buildSearchQuery(params);
      const maxResults = params.maxResults || 20;

      console.log(`Searching Gmail with query: ${query}`);

      // Search for messages
      const response = await gmail.users.messages.list({
        userId: 'me',
        q: query,
        maxResults,
      });

      const messages = response.data.messages || [];

      if (messages.length === 0) {
        return [];
      }

      // Fetch full message details
      const emailPromises = messages.map(async (message) => {
        const fullMessage = await gmail.users.messages.get({
          userId: 'me',
          id: message.id!,
          format: 'metadata',
          metadataHeaders: ['From', 'Subject', 'Date'],
        });

        const headers = fullMessage.data.payload?.headers || [];
        const getHeader = (name: string) =>
          headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value || '';

        return {
          id: fullMessage.data.id!,
          threadId: fullMessage.data.threadId!,
          subject: getHeader('Subject'),
          from: getHeader('From'),
          date: getHeader('Date'),
          snippet: fullMessage.data.snippet || '',
        };
      });

      return await Promise.all(emailPromises);
    } catch (error: any) {
      console.error('Gmail search failed:', error);
      throw new Error(`Gmail API error: ${error.message}`);
    }
  }

  /**
   * Get user's Gmail profile
   */
  async getProfile(accessToken: string): Promise<{ email: string }> {
    try {
      const gmail = this.createGmailClient(accessToken);
      const response = await gmail.users.getProfile({ userId: 'me' });

      return {
        email: response.data.emailAddress || '',
      };
    } catch (error: any) {
      console.error('Failed to get Gmail profile:', error);
      throw new Error(`Gmail API error: ${error.message}`);
    }
  }
}

export const gmailService = new GmailService();
