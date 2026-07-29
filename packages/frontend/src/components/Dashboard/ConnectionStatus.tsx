import { useQuery } from '@tanstack/react-query';
import { getAccountStatus } from '../../services/api';

export const ConnectionStatus = () => {
  const { data: status, isLoading, error } = useQuery({
    queryKey: ['accountStatus'],
    queryFn: getAccountStatus,
    refetchInterval: 10000,
  });

  const handleConnectAccount = async (connection: string) => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/api/myaccount/connect`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ connection }),
        }
      );

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || 'Failed to initiate connection');
      }

      const data = await response.json();
      if (data.authorizationUrl) {
        window.location.href = data.authorizationUrl;
      } else {
        throw new Error('No authorization URL returned');
      }
    } catch (error: any) {
      console.error('Failed to connect account:', error);
      alert(`Failed to connect: ${error.message}`);
    }
  };

  if (isLoading) return <div className="text-gray-500">Loading connection status...</div>;
  if (error) return <div className="text-red-500">Failed to load connection status</div>;

  return (
    <div className="bg-white rounded-lg shadow-md p-6 space-y-4">
      <h2 className="text-2xl font-bold mb-4">Connected Accounts</h2>

      {/* Google Connection */}
      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
        <div className="flex items-center space-x-3">
          <div className={`w-3 h-3 rounded-full ${status?.google?.connected ? 'bg-green-500' : 'bg-red-500'}`} />
          <div>
            <h3 className="font-semibold">Google / Gmail</h3>
            {status?.google?.email && (
              <p className="text-sm text-gray-600">{status?.google?.email}</p>
            )}
          </div>
        </div>
        {!status?.google?.connected && (
          <button
            onClick={() => handleConnectAccount('google-oauth2')}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg text-sm"
          >
            Connect Google
          </button>
        )}
      </div>

      {/* Discord Connection */}
      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
        <div className="flex items-center space-x-3">
          <div className={`w-3 h-3 rounded-full ${status?.discord?.connected ? 'bg-green-500' : 'bg-red-500'}`} />
          <div>
            <h3 className="font-semibold">Discord</h3>
            {status?.discord?.username && (
              <p className="text-sm text-gray-600">{status?.discord?.username}</p>
            )}
          </div>
        </div>
        {!status?.discord?.connected && (
          <button
            onClick={() => handleConnectAccount('discord')}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-4 rounded-lg text-sm"
          >
            Connect Discord
          </button>
        )}
      </div>

      {status?.google?.connected && status?.discord?.connected && (
        <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-green-800 font-semibold">All accounts connected!</p>
          <p className="text-green-700 text-sm mt-1">You can now use the chat interface to search Gmail.</p>
        </div>
      )}
    </div>
  );
};
