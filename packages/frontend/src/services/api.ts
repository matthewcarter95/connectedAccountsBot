import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true, // send session cookie on every request
});

export interface ChatMessageRequest { prompt: string; }
export interface ChatMessageResponse {
  emailsFound: number;
  emailsSent: number;
  discordMessageId?: string;
  metadata: { processingTimeMs: number; tokensUsed?: number };
}
export interface AccountStatus {
  google: { connected: boolean; email?: string };
  discord: { connected: boolean; username?: string };
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

export const sendChatMessage = async (prompt: string): Promise<ChatMessageResponse> => {
  const response = await apiClient.post<ChatMessageResponse>('/api/chat/message', { prompt });
  return response.data;
};

export const getChatHistory = async (limit = 50): Promise<ChatHistoryItem[]> => {
  const response = await apiClient.get<ChatHistoryItem[]>('/api/chat/history', { params: { limit } });
  return Array.isArray(response.data) ? response.data : [];
};

export const getAccountStatus = async (): Promise<AccountStatus> => {
  const response = await apiClient.get<AccountStatus>('/api/accounts/status');
  const data = response.data;
  return {
    google: data?.google ?? { connected: false },
    discord: data?.discord ?? { connected: false },
  };
};
