// Session-based auth helpers — replaces the old JWT middleware.
// express-openid-connect (mounted in app.ts) handles the OIDC flow and
// populates req.oidc on every request.
import { Request } from 'express';

/**
 * Extract the Auth0 user ID (sub claim) from the OIDC session.
 * Throws if the request is not authenticated — only call on routes
 * already protected by the requireAuth middleware in app.ts.
 */
export const extractUserId = (req: Request): string => {
  const sub = (req as any).oidc?.user?.sub;
  if (!sub) throw new Error('User not authenticated');
  return sub;
};
