import type { FastifyRequest, FastifyReply } from 'fastify';
import prisma from '../db/prisma';

/**
 * GET /api/v1/tasks?limit=50
 *   → { processing: Task[], recent: Task[] }
 */
export async function listTasks(
  req: FastifyRequest,
  reply: FastifyReply,
) {
  if (!req.userId)
    return reply.code(401).send({ error: 'Unauthorized.' });

  const { limit = '50' } = req.query as { limit?: string };
  const take = Number(limit) || 50;

  const u = await prisma.user.findUnique({
    where: { id: req.userId },
    select: { activeGoogleAccountId: true },
  });
  if (!u?.activeGoogleAccountId) {
    return reply.send({ processing: [], recent: [] });
  }

  const [processing, recent] = await Promise.all([
    prisma.unsubscribeTask.findMany({
      where: {
        googleAccountId: u.activeGoogleAccountId,
        status: 'processing',
      },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        sender: true,      
        url: true,
        status: true,
        updatedAt: true,
      },
    }),
    prisma.unsubscribeTask.findMany({
      where: {
        googleAccountId: u.activeGoogleAccountId,
        status: { in: ['success', 'failed'] },
      },
      orderBy: { updatedAt: 'desc' },
      take,
      select: {
        id: true,
        sender: true,      
        url: true,
        status: true,
        updatedAt: true,
      },
    }),
  ]);

  reply.send({ processing, recent });
}
