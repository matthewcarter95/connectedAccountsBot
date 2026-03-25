// Chat orchestration service: LLM → Gmail → Discord
import { supabase } from '../lib/supabaseClient.js';
import { authService } from './authService.js';
import { llmService } from './llmService.js';
import { gmailService } from './gmailService.js';
import { discordService } from './discordService.js';
import { ChatResponse } from '../types/index.js';

export class ChatService {
  /**
   * Process a chat message: extract params, search Gmail, send to Discord
   */
  async processMessage(auth0UserId: string, prompt: string): Promise<ChatResponse> {
    const startTime = Date.now();

    // Find or create user in database
    const user = await this.ensureUser(auth0UserId);

    // Create chat message record
    const { data: chatMessage, error: createError } = await supabase
      .from('chat_messages')
      .insert({
        user_id: user.id,
        prompt,
        status: 'processing',
      })
      .select()
      .single();

    if (createError || !chatMessage) {
      throw new Error(`Failed to create chat message: ${createError?.message}`);
    }

    try {
      // Step 1: Extract search parameters using LLM
      console.log('Extracting search parameters from prompt...');
      const searchParams = await llmService.extractSearchParams(prompt);
      console.log('Search params:', searchParams);

      // Step 2: Get user's Google OAuth token
      console.log('Fetching Google OAuth token...');
      const googleToken = await authService.getGoogleToken(auth0UserId);
      if (!googleToken) {
        throw new Error('Google account not connected');
      }

      // Step 3: Search Gmail
      console.log('Searching Gmail...');
      const emails = await gmailService.searchEmails(googleToken, searchParams);
      console.log(`Found ${emails.length} emails`);

      // Step 4: Get user's Discord OAuth token
      console.log('Fetching Discord OAuth token...');
      const discordToken = await authService.getDiscordToken(auth0UserId);
      if (!discordToken) {
        throw new Error('Discord account not connected');
      }

      // Step 5: Format and send to Discord
      console.log('Sending results to Discord...');
      const discordMessage = llmService.formatEmailsForDiscord(emails, prompt);
      const messageIds = await discordService.sendLongDM(discordToken, discordMessage);

      const processingTimeMs = Date.now() - startTime;

      // Update chat message record
      const { error: updateError } = await supabase
        .from('chat_messages')
        .update({
          status: 'completed',
          emails_found: emails.length,
          emails_sent: emails.length,
          discord_message_id: messageIds[0],
          processing_time_ms: processingTimeMs,
        })
        .eq('id', chatMessage.id);

      if (updateError) {
        console.error('Failed to update chat message:', updateError);
      }

      return {
        emailsFound: emails.length,
        emailsSent: emails.length,
        discordMessageId: messageIds[0],
        metadata: {
          processingTimeMs,
        },
      };
    } catch (error: any) {
      console.error('Chat processing failed:', error);

      // Update chat message with error
      await supabase
        .from('chat_messages')
        .update({
          status: 'failed',
          error_message: error.message,
        })
        .eq('id', chatMessage.id);

      throw error;
    }
  }

  /**
   * Ensure user exists in database
   */
  private async ensureUser(auth0UserId: string): Promise<any> {
    console.log('ensureUser called with:', auth0UserId);

    // Try to find existing user
    const { data: existingUser, error: findError } = await supabase
      .from('users')
      .select('*')
      .eq('auth0_id', auth0UserId)
      .single();

    if (existingUser) {
      console.log('Found existing user:', existingUser.id);
      return existingUser;
    }

    if (findError && findError.code !== 'PGRST116') {
      // PGRST116 is "not found" - any other error is a problem
      console.error('Error finding user:', findError);
    }

    console.log('User not found, creating new user...');

    // Create new user (email will be updated from Auth0 token)
    const { data: newUser, error: createError } = await supabase
      .from('users')
      .insert({
        auth0_id: auth0UserId,
        email: `${auth0UserId.split('|')[1] || 'user'}@temp.local`, // Temporary email
      })
      .select()
      .single();

    if (createError) {
      console.error('Failed to create user:', createError);

      // If duplicate key error, try to fetch the existing user again
      if (createError.code === '23505') {
        console.log('Duplicate key, fetching existing user...');
        const { data: retryUser } = await supabase
          .from('users')
          .select('*')
          .eq('auth0_id', auth0UserId)
          .single();

        if (retryUser) {
          return retryUser;
        }
      }

      throw new Error(`Failed to create user: ${createError.message}`);
    }

    if (!newUser) {
      throw new Error('Failed to create user: No user returned');
    }

    console.log('Created new user:', newUser.id);
    return newUser;
  }

  /**
   * Get chat history for a user
   */
  async getChatHistory(auth0UserId: string, limit: number = 50) {
    // Find user
    const { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('auth0_id', auth0UserId)
      .single();

    if (!user) {
      return [];
    }

    // Get chat messages
    const { data: messages, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Failed to get chat history:', error);
      return [];
    }

    return messages || [];
  }

  /**
   * Get account connection status
   */
  async getAccountStatus(auth0UserId: string) {
    const googleConnected = await authService.hasConnectedProvider(auth0UserId, 'google-oauth2');
    const discordConnected = await authService.hasConnectedProvider(auth0UserId, 'discord');

    let googleEmail: string | undefined;
    let discordUsername: string | undefined;

    if (googleConnected) {
      try {
        const googleToken = await authService.getGoogleToken(auth0UserId);
        if (googleToken) {
          const profile = await gmailService.getProfile(googleToken);
          googleEmail = profile.email;
        }
      } catch (error) {
        console.error('Failed to get Google profile:', error);
      }
    }

    if (discordConnected) {
      try {
        const discordToken = await authService.getDiscordToken(auth0UserId);
        if (discordToken) {
          const profile = await discordService.getCurrentUser(discordToken);
          discordUsername = `${profile.username}#${profile.discriminator}`;
        }
      } catch (error) {
        console.error('Failed to get Discord profile:', error);
      }
    }

    return {
      google: {
        connected: googleConnected,
        email: googleEmail,
      },
      discord: {
        connected: discordConnected,
        username: discordUsername,
      },
    };
  }
}

export const chatService = new ChatService();
