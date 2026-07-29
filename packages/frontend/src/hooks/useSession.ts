// Session-based auth hook — replaces useAuth0.
// Fetches the current user from the backend's /auth/me endpoint.
// The backend sets an httpOnly session cookie; the frontend never touches a token.

import { useState, useEffect } from 'react';

export interface SessionUser {
  sub: string;
  name?: string;
  email?: string;
  picture?: string;
}

export interface SessionState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: SessionUser | null;
}

export function useSession(): SessionState {
  const [state, setState] = useState<SessionState>({
    isAuthenticated: false,
    isLoading: true,
    user: null,
  });

  useEffect(() => {
    const API = import.meta.env.VITE_API_BASE_URL;
    fetch(`${API}/auth/me`, { credentials: 'include' })
      .then(async (res) => {
        if (res.ok) {
          const data = await res.json();
          setState({ isAuthenticated: data.authenticated, isLoading: false, user: data.user ?? null });
        } else {
          setState({ isAuthenticated: false, isLoading: false, user: null });
        }
      })
      .catch(() => setState({ isAuthenticated: false, isLoading: false, user: null }));
  }, []);

  return state;
}
