import { useAuth0 } from '@auth0/auth0-react';
import { clearStoredTokens } from '../../services/api';

export const LogoutButton = () => {
  const { logout } = useAuth0();

  const handleLogout = async () => {
    // Clear stored tokens from backend before logging out
    try {
      await clearStoredTokens();
    } catch (error) {
      console.error('Failed to clear stored tokens:', error);
      // Continue with logout even if token clearing fails
    }
    logout({ logoutParams: { returnTo: window.location.origin } });
  };

  return (
    <button
      onClick={handleLogout}
      className="bg-gray-600 hover:bg-gray-700 text-white font-semibold py-2 px-4 rounded-lg shadow-md transition duration-200"
    >
      Log Out
    </button>
  );
};
