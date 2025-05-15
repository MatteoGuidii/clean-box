import type { FastifyRequest, FastifyReply } from 'fastify';
import prisma from '../db/prisma';

/**
 * GET /api/v1/stats
 * Aggregate unsubscribe stats for the caller’s **active Gmail** account.
 * ────────────────────────────────────────────────────────────────────────────
 * Response shape
 *   {
 *     totalAttempted:   number,   // all jobs ever queued
 *     successful:       number,   // status === "success"
 *     failed:           number,   // status === "failed"
 *     emailsAvoidedEstimate: number  // naïve 50‑mails‑per‑list heuristic
 *   }
 */
export async function getStats(req: FastifyRequest, reply: FastifyReply) {
  if (!req.userId) return reply.code(401).send({ error: 'Unauthorized.' });

  // ── active Gmail account ────────────────────────────────────────────────
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    select: { activeGoogleAccountId: true },
  });
  if (!user?.activeGoogleAccountId) {
    return reply.send({ totalAttempted: 0, successful: 0, failed: 0, emailsAvoidedEstimate: 0 });
  }

  const baseWhere = {
    subscription: {
      googleAccountId: user.activeGoogleAccountId,
    },
  } as const;

  // ── counts ──────────────────────────────────────────────────────────────
  const [total, successful, failed] = await Promise.all([
    prisma.unsubscribeTask.count({ where: baseWhere }),
    prisma.unsubscribeTask.count({ where: { ...baseWhere, status: 'success' } }),
    prisma.unsubscribeTask.count({ where: { ...baseWhere, status: 'failed' } }),
  ]);

  reply.send({
    totalAttempted: total,
    successful,
    failed,
    emailsAvoidedEstimate: successful * 50, // rough heuristic
  });
}
