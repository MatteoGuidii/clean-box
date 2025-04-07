import 'fastify';
import { FastifyRequest, FastifyReply } from 'fastify';

declare module 'fastify' {
  interface FastifyInstance {
    /**
     * JWT + DB lookup hook.
     * Verifies the JWT, loads the user, and populates request.userId.
     */
    authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void>;
  }

  interface FastifyRequest {
    /** Populated by `authenticate` hook */
    userId: string;
  }
}
