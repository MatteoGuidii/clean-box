import type { FastifyRequest, FastifyReply } from 'fastify';
import prisma from '../db/prisma';

/**
 * GET /api/v1/stats
 * returns aggregate numbers for the **active Gmail** of the current user.
 */
export async function getStats(req: FastifyRequest, reply: FastifyReply) {
  if (!req.userId) return reply.code(401).send({ error: 'Unauthorized.' });

  // find active gmail
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    select: { activeGoogleAccountId: true },
  });
  if (!user?.activeGoogleAccountId) {
    return reply.send({
      totalAttempted: 0,
      successful: 0,
      failed: 0,
      emailsAvoidedEstimate: 0,
    });
  }

  // counts
  const [total, successful, failed] = await Promise.all([
    prisma.unsubscribeTask.count({
      where: { googleAccountId: user.activeGoogleAccountId },
    }),
    prisma.unsubscribeTask.count({
      where: {
        googleAccountId: user.activeGoogleAccountId,
        status: 'success',
      },
    }),
    prisma.unsubscribeTask.count({
      where: {
        googleAccountId: user.activeGoogleAccountId,
        status: 'failed',
      },
    }),
  ]);

  reply.send({
    totalAttempted: total,
    successful,
    failed,
    // very rough estimate: assume each mailing list sends 50 msgs / month
    emailsAvoidedEstimate: successful * 50,
  });
}
