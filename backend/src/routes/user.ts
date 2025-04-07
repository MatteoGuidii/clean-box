import { FastifyInstance } from 'fastify';
import { signup, login, logout, getMe } from '../controllers/userController';
import { asyncHandler } from '../utils/asyncHandler';

export default async function userRoutes(app: FastifyInstance) {
  app.post('/signup', asyncHandler(signup));
  app.post('/login', asyncHandler(login));
  app.post('/logout', asyncHandler(logout));
  app.get('/me', { preHandler: [app.authenticate] }, asyncHandler(getMe));
}
