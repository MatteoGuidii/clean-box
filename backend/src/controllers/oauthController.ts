// src/controllers/oauthController.ts
import { FastifyRequest, FastifyReply } from 'fastify';
import { OAuth2Client } from 'google-auth-library';
import prisma from '../db/prisma';
import { asyncHandler } from '../utils/asyncHandler';

/* ---------- env checks ---------- */
['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_CALLBACK_URL'].forEach(
  k => { if (!process.env[k]) console.error(`CRITICAL env ${k} missing`); },
);
const FRONTEND = process.env.FRONTEND_ORIGIN || 'http://localhost:5173';

/* ---------- Google client ---------- */
const oauth2 = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID!,
  process.env.GOOGLE_CLIENT_SECRET!,
  process.env.GOOGLE_CALLBACK_URL!,
);

/* ------------------------------------------------------------------ */
/* 1. START OAuth flow                                                */
/* ------------------------------------------------------------------ */
export const initiateGoogleOAuth = asyncHandler(
  async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.userId) return reply.code(401).send({ error: 'Login first.' });

    const scopes = [
      'https://www.googleapis.com/auth/gmail.metadata',
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/userinfo.email',
    ];

    const url = oauth2.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      include_granted_scopes: true,
      scope: scopes,
      state: String(req.userId),            // CSRF tie‑back
    });

    reply.redirect(url);
  },
);

/* ------------------------------------------------------------------ */
/* 2. HANDLE callback                                                 */
/* ------------------------------------------------------------------ */
export const handleGoogleOAuthCallback = asyncHandler(
  async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.userId) {
      return reply.redirect(`${FRONTEND}/login?error=session_expired`);
    }

    const { code } = req.query as { code?: string };
    if (!code) {
      return reply.redirect(`${FRONTEND}/dashboard?error=no_code`);
    }

    try {
      const { tokens } = await oauth2.getToken(code);
      const { access_token, refresh_token, expiry_date, scope } = tokens;

      /* ----- fetch Gmail address (must succeed!) ------------------ */
      let email: string | null = null;
      if (access_token) {
        email = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
          headers: { Authorization: `Bearer ${access_token}` },
        })
          .then(r => (r.ok ? r.json() : null))
          .then(j => j?.email ?? null)
          .catch(() => null);
      }

      if (!email) {
        console.error('[OAuth] Could not retrieve Gmail address.');
        return reply.redirect(
          `${FRONTEND}/dashboard?error=no_email`,
        );
      }

      /* ----- upsert GoogleAccount row ----------------------------- */
      const account = await prisma.googleAccount.upsert({
        where: {
          userId_email: { userId: req.userId, email }, // composite unique
        },
        update: {
          accessToken: access_token ?? undefined,
          tokenExpiry: expiry_date ? new Date(expiry_date) : null,
          scopes: scope?.split(' ') ?? [],
          ...(refresh_token && { refreshToken: refresh_token }),
          /* (optional) isRevoked: false */
        },
        create: {
          userId: req.userId,
          email,
          accessToken: access_token ?? undefined,
          refreshToken: refresh_token!,     // first‑time must exist
          tokenExpiry: expiry_date ? new Date(expiry_date) : null,
          scopes: scope?.split(' ') ?? [],
        },
      });

      /* ----- set as ACTIVE --------------------------------------- */
      await prisma.user.update({
        where: { id: req.userId },
        data: { activeGoogleAccountId: account.id },
      });

      reply.redirect(`${FRONTEND}/dashboard?connected=true`);
    } catch (err: any) {
      console.error('[OAuth] callback error', err);
      reply.redirect(
        `${FRONTEND}/dashboard?error=${encodeURIComponent(
          err.message || 'token_exchange_failed',
        )}`,
      );
    }
  },
);

/* ------------------------------------------------------------------ */
/* 3. DISCONNECT active Gmail                                         */
/* ------------------------------------------------------------------ */
export const disconnectGoogleAccount = asyncHandler(
  async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.userId) return reply.code(401).send({ error: 'Unauthorized' });

    /* 1. load active account id */
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { activeGoogleAccountId: true },
    });
    if (!user?.activeGoogleAccountId) {
      return reply.send({ message: 'No Gmail connected.' });
    }

    /* 2. revoke token (best effort) */
    const { refreshToken } = await prisma.googleAccount.findUniqueOrThrow({
      where: { id: user.activeGoogleAccountId },
      select: { refreshToken: true },
    });
    if (refreshToken) {
      await fetch(
        'https://oauth2.googleapis.com/revoke',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: `token=${encodeURIComponent(refreshToken)}`,
        },
      ).catch(() => {});
    }

    /* 3. clear tokens + unset active id (do NOT delete row) */
    await prisma.googleAccount.update({
      where: { id: user.activeGoogleAccountId },
      data: {
        accessToken: null,
        refreshToken: undefined,
        tokenExpiry: null,
        /* (optional) isRevoked: true */
      },
    });
    await prisma.user.update({
      where: { id: req.userId },
      data: { activeGoogleAccountId: null },
    });

    reply.send({ message: 'Google account disconnected.' });
  },
);
