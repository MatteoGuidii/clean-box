// src/controllers/oauthController.ts
import { FastifyRequest, FastifyReply } from 'fastify';
import { OAuth2Client } from 'google-auth-library';
import prisma from '../db/prisma';
import { asyncHandler } from '../utils/asyncHandler';
import { encrypt } from '../utils/encryption'; // Import encrypt

// Environment variable checks (assuming dotenv loaded once in server.ts or preloaded)
// These checks run once when the module loads. Consider a dedicated config module for validation.
if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_CALLBACK_URL) {
  console.error('CRITICAL: Missing Google OAuth environment variables!');
  // Optionally throw error to prevent startup if critical
  // throw new Error("Missing Google OAuth environment variables!");
}
if (!process.env.FRONTEND_ORIGIN) {
  console.warn('WARN: Missing FRONTEND_ORIGIN environment variable! Using fallback.');
}
if (!process.env.GOOGLE_TOKEN_ENCRYPTION_KEY) {
    console.error('CRITICAL: Missing GOOGLE_TOKEN_ENCRYPTION_KEY environment variable!');
    // Optionally throw error
    // throw new Error('Missing required GOOGLE_TOKEN_ENCRYPTION_KEY environment variable');
}


// Initialize Google OAuth2 client
// Ensure env vars are correctly loaded *before* this line executes
const oauth2Client = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID!,
  process.env.GOOGLE_CLIENT_SECRET!,
  process.env.GOOGLE_CALLBACK_URL!,
);

// 1. Initiate Google OAuth Flow
export const initiateGoogleOAuth = asyncHandler(
  async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.userId) {
      return reply.status(401).send({ error: 'User must be logged in.' });
    }

    // Define scopes needed
    const scopes = [
      'https://www.googleapis.com/auth/userinfo.email', // To get user's Google email address
      'https://www.googleapis.com/auth/gmail.metadata', // To scan for List-Unsubscribe headers
    ];

    // Generate the authorization URL
    const authorizeUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline', // Request refresh token
      scope: scopes,
      prompt: 'consent', // Force consent screen (good for testing, maybe remove in prod)
    });

    console.log('[OAuthController] Redirecting user to Google');
    reply.redirect(authorizeUrl);
  },
);

// 2. Handle Google OAuth Callback
export const handleGoogleOAuthCallback = asyncHandler(
  async (req: FastifyRequest, reply: FastifyReply) => {
    // Determine frontend origin for redirects
    const frontendOrigin = process.env.FRONTEND_ORIGIN || 'http://localhost:5173';

    // Ensure user is still logged into our app session
    if (!req.userId) {
      console.error('[OAuthController] Callback received without active session.');
      return reply.redirect(`${frontendOrigin}/login?error=session_expired`);
    }

    // Get the authorization code from the query parameters
    const { code } = req.query as { code?: string };
    if (!code) {
      console.error('[OAuthController] No authorization code received from Google.');
      return reply.redirect(`${frontendOrigin}/dashboard?error=oauth_failed_no_code`);
    }

    console.log('[OAuthController] Received code, attempting to exchange for tokens...');
    try {
      // Exchange the authorization code for tokens
      const { tokens } = await oauth2Client.getToken(code);

      // Extract individual tokens
      const { access_token, refresh_token, expiry_date, scope } = tokens;

      // Log presence of refresh token
      if (refresh_token) {
          console.log('[OAuthController] Refresh token IS PRESENT in the response from Google.');
      } else {
          console.warn('[OAuthController] Refresh token IS MISSING in the response from Google.');
      }

      // Fetch Google User Info using the received access token
      let googleUserEmail: string | undefined | null = null;
      if (access_token) {
        // --- FIX: Set credentials on the client BEFORE making requests ---
        // This configures the oauth2Client instance to use the newly obtained tokens
        // for subsequent requests made with this instance.
        oauth2Client.setCredentials(tokens);
        // -----------------------------------------------------------------
        try {
          console.log('[OAuthController] Fetching Google user info...');
          // Make authenticated request to Google's userinfo endpoint
          const userInfoResponse = await oauth2Client.request<{ email?: string }>({
              url: 'https://www.googleapis.com/oauth2/v2/userinfo'
          });
          googleUserEmail = userInfoResponse.data.email; // Extract email from response data
          console.log('[OAuthController] Fetched Google User Info, Email:', googleUserEmail);
        } catch (userInfoError) {
          console.error('[OAuthController] Error fetching Google user info:', userInfoError);
          // Decide how to handle this: maybe log and continue, or redirect with error?
          // Continuing allows connection saving even if email fetch fails.
        }
      } else {
        console.warn('[OAuthController] No access token received, cannot fetch Google user info.');
      }

      // Encrypt the refresh token if one was received
      let encryptedRefreshToken: string | null = null;
      if (refresh_token) {
        console.log('[OAuthController] Attempting to encrypt refresh token...');
        try {
            encryptedRefreshToken = encrypt(refresh_token); // Call your encryption utility
            console.log('[OAuthController] Refresh token encrypted successfully.');
        } catch(encryptionError) {
             console.error('[OAuthController] CRITICAL: Failed to encrypt refresh token!', encryptionError);
             // If encryption fails, we cannot securely store the token. Throw error.
             throw new Error('Failed to secure refresh token during callback.');
        }
      }

      // Save/Update tokens and status in the database
      console.log('[OAuthController] Attempting to update user in database...');
      await prisma.user.update({
        where: { id: req.userId }, // Update the record for the logged-in user
        data: {
          isGmailConnected: true, // Mark as connected
          googleEmail: googleUserEmail || null, // Store the connected Google email
          googleAccessToken: access_token || null, // Store current access token (optional)
          // Conditionally update refresh token only if a new encrypted one was generated
          ...(encryptedRefreshToken && { googleRefreshToken: encryptedRefreshToken }),
          googleTokenExpiry: expiry_date ? new Date(expiry_date) : null, // Store expiry time
          googleScopes: scope ? scope.split(' ') : [], // Store granted scopes
        },
      });

      console.log('[OAuthController] User record updated successfully for user:', req.userId);
      // Redirect back to the frontend dashboard, indicating success
      reply.redirect(`${frontendOrigin}/dashboard?connected=true`);

    } catch (error: any) {
      // Handle errors during token exchange or DB update
      console.error('[OAuthController] Error during OAuth callback processing:', error);
      // Try to extract a meaningful error message
      const errorMessage = error.response?.data?.error_description || // Standard OAuth error
                           error.response?.data?.error ||          // Another common OAuth error field
                           error.message ||                        // General error message
                           'token_processing_failed';              // Fallback
      // Redirect back to frontend dashboard with error message
      reply.redirect(
        `${frontendOrigin}/dashboard?error=${encodeURIComponent(errorMessage)}`,
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
      // Optional: Add logic here to revoke the token with Google using oauth2Client.revokeToken()
      // This requires fetching the user, decrypting the refresh token first.

      // Clear stored tokens and status in database
      await prisma.user.update({
        where: { id: req.userId },
        data: {
          isGmailConnected: false,
          googleEmail: null,
          googleAccessToken: null,
          googleRefreshToken: null, // Clear the encrypted token
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
