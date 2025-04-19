// src/utils/auth.ts
import { FastifyReply } from 'fastify';

/**
 * Signs a JWT for the given userId and sets it as a
 * secure, HTTP‑only cookie on the reply.
 */
export async function createUserSession(reply: FastifyReply, userId: string): Promise<string> {
  // 1) Sign the token using the FastifyReply decorator
  const token = await reply.jwtSign({ userId });

  // 2) Set it as a cookie
  reply.setCookie('token', token, {
    maxAge: 15 * 24 * 60 * 60, // 15 days (in seconds)
    httpOnly: true, // mitigates XSS
    sameSite: 'lax', // mitigates CSRF
    secure: process.env.NODE_ENV !== 'development', // HTTPS in prod
    path: '/', // cookie is valid site‑wide
  });

  return token;
}
