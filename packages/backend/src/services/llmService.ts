// OpenAI LLM service for extracting search parameters from natural language
import OpenAI from 'openai';
import { LLMExtractionResult } from '../types/index.js';

export class LLMService {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  /**
   * Extract Gmail search parameters from natural language prompt
   */
  async extractSearchParams(prompt: string): Promise<LLMExtractionResult> {
    const systemPrompt = `You are a helpful assistant that extracts Gmail search parameters from natural language queries.

Given a user's prompt, extract the following information in JSON format:
- query: The main search terms (required)
- dateRange: Optional object with start/end dates in YYYY-MM-DD format
- from: Optional sender email or name
- subject: Optional subject line keywords

Examples:

User: "Find email with Google Workspace invoice from March"
Response: {
  "query": "Google Workspace invoice",
  "dateRange": {
    "start": "2026-03-01",
    "end": "2026-03-31"
  }
}

User: "Show me emails from john@example.com about project updates"
Response: {
  "query": "project updates",
  "from": "john@example.com"
}

User: "Find receipts from last week"
Response: {
  "query": "receipt",
  "dateRange": {
    "start": "2026-03-16",
    "end": "2026-03-23"
  }
}

Today's date is ${new Date().toISOString().split('T')[0]}.

Return ONLY valid JSON with no additional text.`;

    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt },
        ],
        temperature: 0.1,
        response_format: { type: 'json_object' },
      });

      const content = completion.choices[0].message.content;
      if (!content) {
        throw new Error('No response from LLM');
      }

      const result = JSON.parse(content) as LLMExtractionResult;

      // Validate required fields
      if (!result.query) {
        throw new Error('LLM did not extract a query');
      }

      return result;
    } catch (error) {
      console.error('LLM extraction failed:', error);
      // Fallback: use the prompt as the query
      return {
        query: prompt,
      };
    }
  }

  /**
   * Format email results into a Discord message
   */
  formatEmailsForDiscord(emails: any[], prompt: string): string {
    if (emails.length === 0) {
      return `🔍 **Gmail Search Results**\n\nNo emails found matching: "${prompt}"`;
    }

    let message = `🔍 **Gmail Search Results** (${emails.length} found)\n`;
    message += `Query: "${prompt}"\n\n`;

    emails.slice(0, 10).forEach((email, index) => {
      message += `**${index + 1}. ${email.subject}**\n`;
      message += `From: ${email.from}\n`;
      message += `Date: ${email.date}\n`;
      message += `${email.snippet}\n\n`;
    });

    if (emails.length > 10) {
      message += `_...and ${emails.length - 10} more emails_\n`;
    }

    return message;
  }
}

export const llmService = new LLMService();
