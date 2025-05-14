import { FastifyInstance } from 'fastify';
import { asyncHandler } from '../utils/asyncHandler';
import { getStats } from '../controllers/statsController';
import { listTasks } from '../controllers/taskListController';

export default async function statsRoutes(app: FastifyInstance) {
  app.get('/stats', { preHandler: [app.authenticate] }, asyncHandler(getStats));
  app.get('/tasks', { preHandler: [app.authenticate] }, asyncHandler(listTasks));
}
