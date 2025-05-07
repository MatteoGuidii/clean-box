// src/controllers/oauthController.ts
import { FastifyRequest, FastifyReply } from 'fastify';
import { OAuth2Client } from 'google-auth-library';
import prisma from '../db/prisma';
import { asyncHandler } from '../utils/asyncHandler';

/* ------------------------------------------------------------------ */
/*  Env checks (ideally done at server bootstrap)                      */
/* ------------------------------------------------------------------ */
['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_CALLBACK_URL'].forEach(
  key => {
    if (!process.env[key]) {
      console.error(`CRITICAL: ${key} env var is missing`);
    }
  },
);

if (!process.env.FRONTEND_ORIGIN) {
  console.warn(
    'WARN: FRONTEND_ORIGIN env var missing – defaulting to http://localhost:5173',
  );
}

/* ------------------------------------------------------------------ */
/*  Google OAuth client                                                */
/* ------------------------------------------------------------------ */
const oauth2Client = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID!,
  process.env.GOOGLE_CLIENT_SECRET!,
  process.env.GOOGLE_CALLBACK_URL!,
);

/* ------------------------------------------------------------------ */
/* 1. Initiate Google OAuth Flow                                       */
/* ------------------------------------------------------------------ */
export const initiateGoogleOAuth = asyncHandler(
  async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.userId) {
      return reply.status(401).send({ error: 'User must be logged in.' });
    }

    const scopes = [
      // keeps metadata‑only listing
      'https://www.googleapis.com/auth/gmail.metadata',
      // NEW: allows use of the `q` search parameter
      'https://www.googleapis.com/auth/gmail.readonly',
      // show email in consent screen
      'https://www.googleapis.com/auth/userinfo.email',
    ];

    const authorizeUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline', // refresh_token
      prompt: 'consent',      // always show to guarantee refresh_token
      include_granted_scopes: true,
      scope: scopes,
      state: String(req.userId), // optional CSRF/user tie‑back
    });

    reply.redirect(authorizeUrl);
  },
);

/* ------------------------------------------------------------------ */
/* 2. Handle OAuth Callback                                            */
/* ------------------------------------------------------------------ */
export const handleGoogleOAuthCallback = asyncHandler(
  async (req: FastifyRequest, reply: FastifyReply) => {
    const frontendOrigin =
      process.env.FRONTEND_ORIGIN || 'http://localhost:5173';

    if (!req.userId) {
      return reply.redirect(
        `${frontendOrigin}/login?error=session_expired`,
      );
    }

    const { code } = req.query as { code?: string };
    if (!code) {
      return reply.redirect(
        `${frontendOrigin}/dashboard?error=oauth_failed_no_code`,
      );
    }

    try {
      const { tokens } = await oauth2Client.getToken(code);
      const { access_token, refresh_token, expiry_date, scope } = tokens;

      /* ----- (optional) fetch email for UI display ----- */
      let googleUserEmail: string | null = null;
      if (access_token) {
        const userInfo = await fetch(
          'https://www.googleapis.com/oauth2/v2/userinfo',
          {
            headers: { Authorization: `Bearer ${access_token}` },
          },
        ).then(r => (r.ok ? r.json() : null));
        googleUserEmail = userInfo?.email ?? null;
      }

      /* ----- Store / update DB ----- */
      await prisma.user.update({
        where: { id: req.userId },
        data: {
          isGmailConnected: true,
          googleEmail: googleUserEmail,
          googleAccessToken: access_token,
          // **IMPORTANT**: refresh_token may be undefined on re‑consent
          ...(refresh_token && { googleRefreshToken: refresh_token }),
          googleTokenExpiry: expiry_date ? new Date(expiry_date) : null,
          googleScopes: scope ? scope.split(' ') : [],
        },
      });

      reply.redirect(`${frontendOrigin}/dashboard?connected=true`);
    } catch (error: any) {
      console.error('[OAuthController] Callback error:', error);
      reply.redirect(
        `${frontendOrigin}/dashboard?error=${encodeURIComponent(
          error.message || 'token_exchange_failed',
        )}`,
      );
    }
  },
);

/* ------------------------------------------------------------------ */
/* 3. Disconnect Google Account                                        */
/* ------------------------------------------------------------------ */
export const disconnectGoogleAccount = asyncHandler(
  async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    try {
      // TODO: optionally call google.oauth2.revokeToken(refresh_token)
      await prisma.user.update({
        where: { id: req.userId },
        data: {
          isGmailConnected: false,
          googleEmail: null,
          googleAccessToken: null,
          googleRefreshToken: null,
          googleTokenExpiry: null,
          googleScopes: [],
        },
      });

      reply.send({ message: 'Google account disconnected successfully.' });
    } catch (error: any) {
      console.error('[OAuthController] Disconnect error:', error);
      reply
        .status(500)
        .send({ error: 'Failed to disconnect Google account.' });
    }
  },
);
