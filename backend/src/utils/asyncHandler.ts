import { FastifyInstance, FastifyRequest, FastifyReply, RouteHandlerMethod } from 'fastify';

/**
 * Wraps an async route handler so any thrown error
 * is caught, logged, and a 500 JSON response is sent.
 */
export function asyncHandler(fn: RouteHandlerMethod): RouteHandlerMethod {
  return async function (this: FastifyInstance, req: FastifyRequest, reply: FastifyReply) {
    try {
      await fn.call(this, req, reply);
    } catch (err: unknown) {
      // 1) Log the error
      req.log.error(err);

      // 2) Extract message
      const message = err instanceof Error ? err.message : 'An unexpected error occurred.';

      // 3) Send standardized error response
      reply.status(500).send({ error: message });
    }
  };
}
