import type { FastifyRequest, FastifyReply } from 'fastify';
import prisma from '../db/prisma';

/**
 * GET /api/v1/tasks?limit=50
 * Returns pending + recent unsubscribe jobs for the caller’s *active* Gmail.
 * We now traverse Subscription → Sender so duplicates are collapsed and the
 * UI can show a friendly sender name.
 */
export async function listTasks(req: FastifyRequest, reply: FastifyReply) {
  if (!req.userId) {
    return reply.code(401).send({ error: 'Unauthorized.' });
  }

  const { limit = '50' } = req.query as { limit?: string };
  const take = Number(limit) || 50;

  /* 1 ▸ Active Google account ID */
  const u = await prisma.user.findUnique({
    where: { id: req.userId },
    select: { activeGoogleAccountId: true },
  });
  if (!u?.activeGoogleAccountId) {
    return reply.send({ processing: [], recent: [] });
  }

  /* Helper to format the nested result → flat object */
  const format = (t: any) => ({
    id: t.id,
    sender: t.subscription.sender?.displayName ?? t.subscription.baseUrl,
    url: t.fullUrl,
    status: t.status,
    updatedAt: t.updatedAt,
  });

  /* 2 ▸ Queries */
  const [processingRaw, recentRaw] = await Promise.all([
    prisma.unsubscribeTask.findMany({
      where: {
        status: 'processing',
        subscription: { googleAccountId: u.activeGoogleAccountId },
      },
      orderBy: { updatedAt: 'desc' },
      include: {
        subscription: { include: { sender: true } },
      },
    }),
    prisma.unsubscribeTask.findMany({
      where: {
        status: { in: ['success', 'failed'] },
        subscription: { googleAccountId: u.activeGoogleAccountId },
      },
      orderBy: { updatedAt: 'desc' },
      take,
      include: {
        subscription: { include: { sender: true } },
      },
    }),
  ]);

  reply.send({
    processing: processingRaw.map(format),
    recent: recentRaw.map(format),
  });
}
