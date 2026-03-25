import { useQuery } from '@tanstack/react-query';
import { useAuth0 } from '@auth0/auth0-react';
import { getAccountStatus } from '../../services/api';

export const ConnectionStatus = () => {
  const { getAccessTokenSilently, getAccessTokenWithPopup, loginWithPopup, user } = useAuth0();

  const { data: status, isLoading, error } = useQuery({
    queryKey: ['accountStatus'],
    queryFn: getAccountStatus,
    refetchInterval: 10000, // Refetch every 10 seconds
  });

  const handleConnectAccount = async (connection: string) => {
    try {
      // Get backend API token for authentication
      const backendToken = await getAccessTokenSilently({
        authorizationParams: {
          audience: import.meta.env.VITE_AUTH0_AUDIENCE,
          scope: 'openid profile email read:messages write:messages read:connections',
        },
      });

      // Get MyAccount API token (with explicit scope override)
      let myAccountToken;
      try {
        myAccountToken = await getAccessTokenSilently({
          cacheMode: 'off', // Don't merge with cached default scopes
          authorizationParams: {
            audience: `https://${import.meta.env.VITE_AUTH0_DOMAIN}/me/`,
            scope: 'openid profile email create:me:connected_accounts read:me:connected_accounts',
          },
        });
      } catch (tokenError: any) {
        // If consent or login required, use popup to avoid losing session
        if (tokenError.error === 'consent_required' || tokenError.error === 'login_required') {
          console.log(`${tokenError.error} for MyAccount API, opening popup...`);
          console.log('Full error:', tokenError);
          try {
            console.log('Opening popup for MyAccount API consent...');

            // Use loginWithPopup WITHOUT connection parameter to leverage SSO
            // This will use the existing Auth0 session instead of re-authenticating
            await loginWithPopup({
              authorizationParams: {
                audience: `https://${import.meta.env.VITE_AUTH0_DOMAIN}/me/`,
                scope: 'openid profile email create:me:connected_accounts read:me:connected_accounts',
                // Don't specify connection - let Auth0 use SSO from existing session
              },
            });

            // After popup login with consent, get the token
            myAccountToken = await getAccessTokenSilently({
              cacheMode: 'off', // Don't merge with cached default scopes
              authorizationParams: {
                audience: `https://${import.meta.env.VITE_AUTH0_DOMAIN}/me/`,
                scope: 'openid profile email create:me:connected_accounts read:me:connected_accounts',
              },
            });
            console.log('Got MyAccount token after consent popup');
          } catch (popupError) {
            console.error('Popup authentication failed:', popupError);
            throw popupError;
          }
        } else {
          console.error('Unexpected token error:', tokenError);
          throw tokenError;
        }
      }

      // Call backend to initiate connected account flow
      // Send backend token for auth, MyAccount token in body
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/myaccount/connect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${backendToken}`,
        },
        body: JSON.stringify({
          connection,
          myAccountToken,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to initiate connection');
      }

      const data = await response.json();

      if (data.authorizationUrl) {
        // Redirect to the OAuth authorization URL
        window.location.href = data.authorizationUrl;
      } else {
        throw new Error('No authorization URL returned');
      }
    } catch (error: any) {
      console.error('Failed to connect account:', error);
      alert(`Failed to connect: ${error.message}`);
    }
  };

  if (isLoading) {
    return <div className="text-gray-500">Loading connection status...</div>;
  }

  if (error) {
    return <div className="text-red-500">Failed to load connection status</div>;
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6 space-y-4">
      <h2 className="text-2xl font-bold mb-4">Connected Accounts</h2>

      {/* Google Connection */}
      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
        <div className="flex items-center space-x-3">
          <div className={`w-3 h-3 rounded-full ${status?.google.connected ? 'bg-green-500' : 'bg-red-500'}`} />
          <div>
            <h3 className="font-semibold">Google / Gmail</h3>
            {status?.google.email && (
              <p className="text-sm text-gray-600">{status.google.email}</p>
            )}
          </div>
        </div>
        {!status?.google.connected && (
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
          <div className={`w-3 h-3 rounded-full ${status?.discord.connected ? 'bg-green-500' : 'bg-red-500'}`} />
          <div>
            <h3 className="font-semibold">Discord</h3>
            {status?.discord.username && (
              <p className="text-sm text-gray-600">{status.discord.username}</p>
            )}
          </div>
        </div>
        {!status?.discord.connected && (
          <button
            onClick={() => handleConnectAccount('discord')}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-4 rounded-lg text-sm"
          >
            Connect Discord
          </button>
        )}
      </div>

      {status?.google.connected && status?.discord.connected && (
        <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-green-800 font-semibold">All accounts connected!</p>
          <p className="text-green-700 text-sm mt-1">You can now use the chat interface to search Gmail.</p>
        </div>
      )}
    </div>
  );
};
