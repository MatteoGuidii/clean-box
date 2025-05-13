import type { FastifyRequest, FastifyReply } from 'fastify';
import prisma from '../db/prisma';

import {
  getAuthedGmail,
  listRecentMessageIds,
  getUnsubscribeUrlIfRecent,
  createTasks,
} from '../services/google';

import { taskQueue } from '../queue/index';   // BullMQ queue

/**
 * POST /scan → enqueue pending unsubscribe tasks for the active Gmail
 */
export async function startScan(req: FastifyRequest, reply: FastifyReply) {
  /* ------------------------------------------------------------------ */
  /* 1. Auth guard                                                      */
  /* ------------------------------------------------------------------ */
  if (!req.userId) {
    return reply.code(401).send({ error: 'Unauthorized.' });
  }

  /* ------------------------------------------------------------------ */
  /* 2. Load user + active GoogleAccount                                */
  /* ------------------------------------------------------------------ */
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    select: { activeGoogleAccountId: true },
  });
  if (!user?.activeGoogleAccountId) {
    return reply.code(400).send({ error: 'No Gmail connected.' });
  }

  const ga = await prisma.googleAccount.findUniqueOrThrow({
    where: { id: user.activeGoogleAccountId },
  });

  /* ------------------------------------------------------------------ */
  /* 3. Gmail client (refresh if needed)                                */
  /* ------------------------------------------------------------------ */
  const gmail = await getAuthedGmail({
    googleRefreshToken: ga.refreshToken,
    googleAccessToken: ga.accessToken,
    googleTokenExpiry: ga.tokenExpiry,
  });

  /* ------------------------------------------------------------------ */
  /* 4. Pull message‑ids with List‑Unsubscribe header (last 30 days)    */
  /* ------------------------------------------------------------------ */
  const ids = await listRecentMessageIds(gmail);
  if (!ids.length) return reply.send({ created: 0 });

  /* ------------------------------------------------------------------ */
  /* 5. Extract unsubscribe URLs (batched)                              */
  /* ------------------------------------------------------------------ */
  const urls: string[] = [];
  const BATCH = 10;

  for (let i = 0; i < ids.length; i += BATCH) {
    const slice = ids.slice(i, i + BATCH);
    const parts = await Promise.all(
      slice.map(id => getUnsubscribeUrlIfRecent(gmail, id)),
    );
    urls.push(...(parts.filter(Boolean) as string[]));
  }
  if (!urls.length) return reply.send({ created: 0 });

  /* ------------------------------------------------------------------ */
  /* 6. Insert tasks (dedup via @@unique)                               */
  /* ------------------------------------------------------------------ */
  const tasks = await createTasks(prisma, ga.id, urls); // googleAccountId!

  /* ------------------------------------------------------------------ */
  /* 7. Enqueue each new task for the worker                            */
  /* ------------------------------------------------------------------ */
  for (const t of tasks) {
    await taskQueue.add('unsubscribe', { id: t.id });
  }

  /* ------------------------------------------------------------------ */
  /* 8. Persist refreshed access‑token (getAuthedGmail mutates object)  */
  /* ------------------------------------------------------------------ */
  await prisma.googleAccount.update({
    where: { id: ga.id },
    data: {
      accessToken: ga.accessToken,
      tokenExpiry: ga.tokenExpiry,
    },
  });

  return reply.send({ created: tasks.length });
}
