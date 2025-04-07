import { FastifyError, FastifyReply, FastifyRequest } from 'fastify';

/**
 * Global error handler for Fastify.
 * Catches any uncaught errors in the Fastify lifecycle,
 * logs them, and sends a standardized JSON response.
 */
export function errorHandler(
  err: FastifyError | unknown,
  request: FastifyRequest,
  reply: FastifyReply,
) {
  // Always log the raw error
  request.log.error(err);

  if (err instanceof Error) {
    // Use err.statusCode if available (FastifyError), else 500
    const statusCode = (err as FastifyError).statusCode ?? 500;
    const message = err.message || 'An unexpected error occurred.';
    reply.status(statusCode).send({ error: message });
  } else {
    // Non-Error thrown
    reply.status(500).send({ error: 'An unexpected error occurred.' });
  }
}
