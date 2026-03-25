// JWT validation middleware using Auth0
import { expressjwt, GetVerificationKey } from 'express-jwt';
import jwksRsa from 'jwks-rsa';
import { Request, Response, NextFunction } from 'express';

const auth0Domain = process.env.AUTH0_DOMAIN!;
const audience = process.env.AUTH0_AUDIENCE!;

/**
 * Validate JWT token from Auth0
 */
export const validateJWT = expressjwt({
  secret: jwksRsa.expressJwtSecret({
    cache: true,
    rateLimit: true,
    jwksRequestsPerMinute: 5,
    jwksUri: `https://${auth0Domain}/.well-known/jwks.json`,
  }) as GetVerificationKey,
  audience,
  issuer: `https://${auth0Domain}/`,
  algorithms: ['RS256'],
});

/**
 * Error handler for JWT validation errors
 */
export const handleJWTError = (
  err: any,
  _req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (err.name === 'UnauthorizedError') {
    res.status(401).json({
      error: 'Invalid token',
      message: err.message,
    });
    return;
  }
  next(err);
};

/**
 * Extract Auth0 user ID from validated JWT
 */
export const extractUserId = (req: Request): string => {
  // After JWT validation, the payload is in req.auth
  const auth = (req as any).auth;
  if (!auth || !auth.sub) {
    throw new Error('User ID not found in token');
  }
  return auth.sub;
};
