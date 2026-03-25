import { useAuth0 } from '@auth0/auth0-react';
import { useEffect } from 'react';
import { LoginButton } from './components/Auth/LoginButton';
import { LogoutButton } from './components/Auth/LogoutButton';
import { ConnectionStatus } from './components/Dashboard/ConnectionStatus';
import { ChatInterface } from './components/Chat/ChatInterface';
import { setAuthToken } from './services/api';

function App() {
  const { isAuthenticated, isLoading, user, getAccessTokenSilently, loginWithRedirect } = useAuth0();

  // Handle MyAccount callback (from OAuth redirect)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connectResult = params.get('connect');

    if (connectResult === 'success') {
      window.history.replaceState({}, document.title, window.location.pathname);
      alert('Account connected successfully!');
    } else if (connectResult === 'error') {
      const errorMessage = params.get('message') || 'Unknown error';
      alert(`Failed to connect account: ${decodeURIComponent(errorMessage)}`);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  // Set auth token when user logs in
  useEffect(() => {
    const setToken = async () => {
      if (isAuthenticated) {
        try {
          const token = await getAccessTokenSilently({
            authorizationParams: {
              audience: import.meta.env.VITE_AUTH0_AUDIENCE,
              scope: 'openid profile email read:messages write:messages read:connections',
            },
          });
          setAuthToken(token);
        } catch (error) {
          console.error('Failed to get access token:', error);
        }
      }
    };
    setToken();
  }, [isAuthenticated, getAccessTokenSilently]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-xl text-gray-600">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <h1 className="text-3xl font-bold mb-4">Connected Accounts Bot</h1>
          <p className="text-gray-600 mb-6">
            Search your Gmail with natural language and get results in Discord DMs
          </p>
          <LoginButton />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-900">Connected Accounts Bot</h1>
            <div className="flex items-center space-x-4">
              <span className="text-gray-600">
                {user?.name || user?.email}
              </span>
              <LogoutButton />
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Connection Status (left sidebar) */}
          <div className="lg:col-span-1">
            <ConnectionStatus />
          </div>

          {/* Chat Interface (main area) */}
          <div className="lg:col-span-2">
            <ChatInterface />
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
