import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { sendChatMessage, getChatHistory } from '../../services/api';
import { supabase } from '../../lib/supabaseClient';
import { useAuth0 } from '@auth0/auth0-react';

interface Message {
  id: string;
  prompt: string;
  emailsFound: number;
  status: string;
  errorMessage?: string;
  createdAt: string;
}

export const ChatInterface = () => {
  const { user } = useAuth0();
  const [prompt, setPrompt] = useState('');
  const queryClient = useQueryClient();

  // Fetch chat history
  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['chatHistory'],
    queryFn: () => getChatHistory(50),
  });

  // Send message mutation
  const sendMessage = useMutation({
    mutationFn: sendChatMessage,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chatHistory'] });
      setPrompt('');
    },
  });

  // Subscribe to real-time updates from Supabase
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('chat_messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['chatHistory'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, queryClient]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || sendMessage.isPending) return;
    sendMessage.mutate(prompt);
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6 h-[600px] flex flex-col">
      <h2 className="text-2xl font-bold mb-4">Gmail Search Chat</h2>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto space-y-4 mb-4">
        {isLoading ? (
          <div className="text-gray-500 text-center py-8">Loading messages...</div>
        ) : messages.length === 0 ? (
          <div className="text-gray-500 text-center py-8">
            <p>No messages yet. Try searching your Gmail!</p>
            <p className="text-sm mt-2">Example: "Find email with invoice from March"</p>
          </div>
        ) : (
          messages.map((message: Message) => (
            <div key={message.id} className="p-4 bg-gray-50 rounded-lg">
              <div className="font-semibold text-blue-600 mb-2">{message.prompt}</div>
              {message.status === 'completed' && (
                <div className="text-sm text-gray-700">
                  Found {message.emailsFound} email{message.emailsFound !== 1 ? 's' : ''} - Sent to Discord DMs
                </div>
              )}
              {message.status === 'processing' && (
                <div className="text-sm text-yellow-600">Processing...</div>
              )}
              {message.status === 'failed' && (
                <div className="text-sm text-red-600">
                  Error: {message.errorMessage || 'Failed to process'}
                </div>
              )}
              <div className="text-xs text-gray-500 mt-2">
                {new Date(message.createdAt).toLocaleString()}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Input form */}
      <form onSubmit={handleSubmit} className="flex space-x-2">
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Search your Gmail... (e.g., 'Find invoices from last month')"
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={sendMessage.isPending}
        />
        <button
          type="submit"
          disabled={!prompt.trim() || sendMessage.isPending}
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-lg disabled:bg-gray-400 disabled:cursor-not-allowed transition duration-200"
        >
          {sendMessage.isPending ? 'Searching...' : 'Send'}
        </button>
      </form>

      {sendMessage.isError && (
        <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {(sendMessage.error as any)?.response?.data?.message || 'Failed to send message'}
        </div>
      )}
    </div>
  );
};
