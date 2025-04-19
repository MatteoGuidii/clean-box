// src/routes/oauthRoutes.ts
import { FastifyInstance } from 'fastify';
import {
    initiateGoogleOAuth,
    handleGoogleOAuthCallback,
    disconnectGoogleAccount
} from '../controllers/oauthController';
import { asyncHandler } from '../utils/asyncHandler';

export default async function oauthRoutes(app: FastifyInstance) {
  // Route to start the OAuth flow - requires logged-in user via authenticate preHandler
  app.get(
    '/connect/google',
    { preHandler: [app.authenticate] },
    asyncHandler(initiateGoogleOAuth)
  );

  // Route Google redirects back to - requires logged-in user via authenticate preHandler
  // This ensures the callback is associated with the correct session
  app.get(
      '/oauth/google/callback',
      { preHandler: [app.authenticate] },
      asyncHandler(handleGoogleOAuthCallback)
  );

  // Route to disconnect account - requires logged-in user
   app.post(
       '/disconnect/google',
       { preHandler: [app.authenticate] },
       asyncHandler(disconnectGoogleAccount)
   );
}