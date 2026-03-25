// Discord API service for sending DMs
import axios from 'axios';
import { DiscordUser } from '../types/index.js';

export class DiscordService {
  private readonly baseURL = 'https://discord.com/api/v10';

  /**
   * Get current user's Discord profile
   */
  async getCurrentUser(accessToken: string): Promise<DiscordUser> {
    try {
      console.log('Calling Discord API to get current user...');
      console.log('Token length:', accessToken?.length);

      const response = await axios.get(`${this.baseURL}/users/@me`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      console.log('Discord user retrieved:', response.data.username);

      return {
        id: response.data.id,
        username: response.data.username,
        discriminator: response.data.discriminator,
      };
    } catch (error: any) {
      console.error('Failed to get Discord user:', error.response?.status, error.response?.data);
      throw new Error(`Discord API error: ${error.response?.status}: ${error.response?.statusText || error.message}`);
    }
  }

  /**
   * Create a DM channel with a user
   */
  private async createDMChannel(accessToken: string, userId: string): Promise<string> {
    try {
      const response = await axios.post(
        `${this.baseURL}/users/@me/channels`,
        {
          recipient_id: userId,
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      return response.data.id;
    } catch (error: any) {
      console.error('Failed to create DM channel:', error);
      throw new Error(`Discord API error: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Send a DM to the user
   */
  async sendDM(accessToken: string, message: string): Promise<string> {
    try {
      // First, get the current user's ID
      const user = await this.getCurrentUser(accessToken);

      // Create DM channel (or get existing one)
      const channelId = await this.createDMChannel(accessToken, user.id);

      // Send message to the DM channel
      const response = await axios.post(
        `${this.baseURL}/channels/${channelId}/messages`,
        {
          content: message,
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      return response.data.id;
    } catch (error: any) {
      console.error('Failed to send Discord DM:', error);
      throw new Error(`Discord API error: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Split message into chunks if it exceeds Discord's character limit
   */
  private splitMessage(message: string, maxLength: number = 2000): string[] {
    if (message.length <= maxLength) {
      return [message];
    }

    const chunks: string[] = [];
    let currentChunk = '';

    const lines = message.split('\n');

    for (const line of lines) {
      if (currentChunk.length + line.length + 1 > maxLength) {
        if (currentChunk) {
          chunks.push(currentChunk);
        }
        currentChunk = line;
      } else {
        currentChunk += (currentChunk ? '\n' : '') + line;
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk);
    }

    return chunks;
  }

  /**
   * Send a long message (splits into multiple messages if needed)
   */
  async sendLongDM(accessToken: string, message: string): Promise<string[]> {
    const chunks = this.splitMessage(message);
    const messageIds: string[] = [];

    for (const chunk of chunks) {
      const messageId = await this.sendDM(accessToken, chunk);
      messageIds.push(messageId);
    }

    return messageIds;
  }
}

export const discordService = new DiscordService();
