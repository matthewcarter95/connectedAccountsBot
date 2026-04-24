import { useAuth0 } from '@auth0/auth0-react';

export const LoginButton = () => {
  const { loginWithRedirect } = useAuth0();

  return (
    <button
      onClick={() => loginWithRedirect({
        authorizationParams: {
          audience: import.meta.env.VITE_AUTH0_AUDIENCE,
          // Include offline_access to get refresh tokens for Federated Token Exchange
          scope: 'openid profile email offline_access read:messages write:messages read:connections',
        },
      })}
      className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg shadow-md transition duration-200"
    >
      Log In with Auth0
    </button>
  );
};
