import fp from 'fastify-plugin';
import fastifyJwt from '@fastify/jwt';
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

export default fp(async function (app: FastifyInstance) {
  // 1) Register @fastify/jwt
  app.register(fastifyJwt, {
    secret: process.env.JWT_SECRET!,
    cookie: {
      cookieName: 'token',
      signed: false,
    },
  });

  // Decorate with `authenticate` preHandler
  app.decorate(
    'authenticate',
    async function (this: FastifyInstance, request: FastifyRequest, reply: FastifyReply) {
      try {
        // Verify token and extract payload
        const payload = await request.jwtVerify<{ userId: string }>();
        // Attach userId to request
        request.userId = payload.userId;
      } catch (err: unknown) {
        // Narrow the unknown error to an Error to inspect name
        let message = 'Unauthorized - Invalid or missing token';
        if (err instanceof Error) {
          if (err.name === 'TokenExpiredError') {
            message = 'Token expired';
          }
        }
        return reply.status(401).send({ error: message });
      }
    },
  );
});
