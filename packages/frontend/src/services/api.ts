import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
});

export interface ChatMessageRequest {
  prompt: string;
}

export interface ChatMessageResponse {
  emailsFound: number;
  emailsSent: number;
  discordMessageId?: string;
  metadata: {
    processingTimeMs: number;
    tokensUsed?: number;
  };
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

export interface ChatHistoryItem {
  id: string;
  prompt: string;
  emailsFound: number;
  emailsSent: number;
  status: string;
  errorMessage?: string;
  createdAt: string;
}

/**
 * Set authorization token for API requests
 */
export const setAuthToken = (token: string) => {
  apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
};

/**
 * Send a chat message
 */
export const sendChatMessage = async (
  prompt: string
): Promise<ChatMessageResponse> => {
  const response = await apiClient.post<ChatMessageResponse>('/api/chat/message', {
    prompt,
  });
  return response.data;
};

/**
 * Get chat history
 */
export const getChatHistory = async (
  limit: number = 50
): Promise<ChatHistoryItem[]> => {
  const response = await apiClient.get<ChatHistoryItem[]>('/api/chat/history', {
    params: { limit },
  });
  return response.data;
};

/**
 * Get account connection status
 */
export const getAccountStatus = async (): Promise<AccountStatus> => {
  const response = await apiClient.get<AccountStatus>('/api/accounts/status');
  return response.data;
};
