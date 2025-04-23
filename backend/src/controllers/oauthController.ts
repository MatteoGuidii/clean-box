// src/controllers/oauthController.ts
import { FastifyRequest, FastifyReply } from 'fastify';
import { OAuth2Client } from 'google-auth-library';
import prisma from '../db/prisma';
import { asyncHandler } from '../utils/asyncHandler';

// Ensure Google environment variables are loaded (checked at startup ideally, or here)
if (
  !process.env.GOOGLE_CLIENT_ID ||
  !process.env.GOOGLE_CLIENT_SECRET ||
  !process.env.GOOGLE_CALLBACK_URL
) {
  // This check might be better placed in server.ts after dotenv.config()
  // Or use a config module that validates env vars on startup.
  console.error('CRITICAL: Missing Google OAuth environment variables!');
  // Optionally throw an error to prevent startup if critical vars are missing
  // throw new Error("Missing Google OAuth environment variables!");
}
// Ensure Frontend Origin is loaded
if (!process.env.FRONTEND_ORIGIN) {
  console.warn('WARN: Missing FRONTEND_ORIGIN environment variable! Using fallback.');
}

// Initialize Google OAuth2 client (assuming env vars are loaded)
const oauth2Client = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID!, // Add '!' if sure they exist after check/startup validation
  process.env.GOOGLE_CLIENT_SECRET!,
  process.env.GOOGLE_CALLBACK_URL!,
);

// 1. Initiate Google OAuth Flow
export const initiateGoogleOAuth = asyncHandler(
  async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.userId) {
      return reply.status(401).send({ error: 'User must be logged in.' });
    }

    const scopes = [
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/gmail.metadata',
    ];

    const authorizeUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent',
    });

    console.log('[OAuthController] Redirecting user to Google');
    reply.redirect(authorizeUrl);
  },
);

// 2. Handle Google OAuth Callback
export const handleGoogleOAuthCallback = asyncHandler(
  async (req: FastifyRequest, reply: FastifyReply) => {
    // Get frontend origin (provide a default fallback for safety)
    const frontendOrigin = process.env.FRONTEND_ORIGIN || 'http://localhost:5173';

    if (!req.userId) {
      console.error('[OAuthController] Callback received without active session.');
      // Redirect to frontend LOGIN page with error
      return reply.redirect(`${frontendOrigin}/login?error=session_expired`);
    }

    const { code } = req.query as { code?: string };

    if (!code) {
      console.error('[OAuthController] No authorization code received.');
      // Redirect to frontend DASHBOARD page with error
      return reply.redirect(`${frontendOrigin}/dashboard?error=oauth_failed_no_code`);
    }

    console.log('[OAuthController] Received code, exchanging for tokens...');
    try {
      const { tokens } = await oauth2Client.getToken(code);
      console.log('[OAuthController] Tokens received.');

      const { access_token, refresh_token, expiry_date, scope } = tokens;

      // --- Fetch Google User Info ---
     let googleUserEmail: string | undefined | null = null;
     if (access_token) {
        // Set credentials on the client to make authenticated requests
        oauth2Client.setCredentials(tokens);
        // Use googleapis library or fetch directly
        try {
            const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
                headers: { 'Authorization': `Bearer ${access_token}` }
            });
            if (userInfoResponse.ok) {
                const userInfo = await userInfoResponse.json();
                googleUserEmail = userInfo.email;
                console.log('[OAuthController] Fetched Google User Info, Email:', googleUserEmail);
            } else {
                 console.warn('[OAuthController] Failed to fetch Google user info:', userInfoResponse.status);
            }
        } catch(userInfoError) {
             console.error('[OAuthController] Error fetching Google user info:', userInfoError);
        }
     } else {
         console.warn('[OAuthController] No access token received, cannot fetch Google user info.');
     }
     
      // ** PRODUCTION SECURITY: ENCRYPT refresh_token HERE **
      const storedRefreshToken = refresh_token;

      // Save/Update tokens and status in the database
      await prisma.user.update({
        where: { id: req.userId },
        data: {
          isGmailConnected: true,
          googleEmail: googleUserEmail || null,
          googleAccessToken: access_token || null,
          ...(storedRefreshToken && { googleRefreshToken: storedRefreshToken }), // Only update if received
          googleTokenExpiry: expiry_date ? new Date(expiry_date) : null,
          googleScopes: scope ? scope.split(' ') : [],
        },
      });

      console.log('[OAuthController] Tokens stored for user:', req.userId);
      // --- CORRECTED REDIRECT (using FRONTEND_ORIGIN) ---
      reply.redirect(`${frontendOrigin}/dashboard?connected=true`);
    } catch (error: any) {
      console.error('[OAuthController] Error exchanging code or saving tokens:', error);
      // --- CORRECTED REDIRECT (using FRONTEND_ORIGIN) ---
      reply.redirect(
        `${frontendOrigin}/dashboard?error=${encodeURIComponent(error.message || 'token_exchange_failed')}`,
      );
    }
  },
);

// 3. Disconnect Google Account
export const disconnectGoogleAccount = asyncHandler(
  async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    console.log('[OAuthController] Disconnecting Google account for user:', req.userId);
    try {
      // Optional: Revoke token... (code omitted for brevity)

      // Clear stored tokens and status in database
      await prisma.user.update({
        where: { id: req.userId },
        data: {
          isGmailConnected: false,
          googleEmail: null,
          googleAccessToken: null,
          googleRefreshToken: null, // Clear the (encrypted) token
          googleTokenExpiry: null,
          googleScopes: [],
        },
      });
      console.log('[OAuthController] Google account disconnected in DB for user:', req.userId);
      reply.send({ message: 'Google account disconnected successfully.' });
    } catch (error: any) {
      console.error('[OAuthController] Error disconnecting Google account:', error);
      reply.status(500).send({ error: 'Failed to disconnect Google account.' });
    }
  },
);
