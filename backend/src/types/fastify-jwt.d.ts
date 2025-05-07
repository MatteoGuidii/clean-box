/**
 * Type‑augmentation for @fastify/jwt.
 * Gives TypeScript the real shape of req.user after `app.jwt.verify()`.
 */

import '@fastify/jwt';

declare module '@fastify/jwt' {
  interface FastifyJWT {
    // ► what you put inside jwt.sign({...})
    payload: { id: string };

    // ► what `request.user` becomes after verify()
    user: {
      id: string;
      email: string;
      isGmailConnected: boolean | null;
      googleRefreshToken: string | null;
      googleAccessToken: string | null;
      googleTokenExpiry: Date | null;
      googleEmail: string | null;
    };
  }
}
