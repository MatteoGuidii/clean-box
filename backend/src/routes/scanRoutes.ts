import { FastifyInstance } from 'fastify';
import { asyncHandler } from '../utils/asyncHandler';
import { startScan } from '../controllers/scanController';

export default async function scanRoutes(app: FastifyInstance) {
  // Final URL = /api/v1/scan  (prefix from server + this path)
  app.post('/scan', { preHandler: [app.authenticate] }, asyncHandler(startScan));
}
