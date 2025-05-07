import type { FastifyRequest, FastifyReply } from 'fastify';
import prisma from '../db/prisma';

import {
  getAuthedGmail,
  listRecentMessageIds,          
  getUnsubscribeUrlIfRecent,    
  createTasks,
} from '../services/google';

/**
 * POST /scan → create pending UnsubscribeTask rows
 */
export async function startScan(req: FastifyRequest, reply: FastifyReply) {
  /* ------------------------------------------------------------------ */
  /* 1.  Auth check                                                     */
  /* ------------------------------------------------------------------ */
  if (!req.userId) {
    return reply.code(401).send({ error: 'Unauthorized.' });
  }

  /* ------------------------------------------------------------------ */
  /* 2.  Load fresh user record                                         */
  /* ------------------------------------------------------------------ */
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    select: {
      id: true,
      isGmailConnected: true,
      googleRefreshToken: true,
      googleAccessToken: true,
      googleTokenExpiry: true,
    },
  });

  if (!user?.isGmailConnected || !user.googleRefreshToken) {
    return reply.code(400).send({ error: 'Google account not connected.' });
  }

  /* ------------------------------------------------------------------ */
  /* 3.  Gmail client (refresh if needed)                               */
  /* ------------------------------------------------------------------ */
  const gmail = await getAuthedGmail({
    googleRefreshToken: user.googleRefreshToken,
    googleAccessToken: user.googleAccessToken,
    googleTokenExpiry: user.googleTokenExpiry,
  });

  /* ------------------------------------------------------------------ */
  /* 4.  List recent message IDs                                        */
  /* ------------------------------------------------------------------ */
  const ids = await listRecentMessageIds(gmail);
  if (!ids.length) return reply.send({ created: 0 });

  /* ------------------------------------------------------------------ */
  /* 5.  Extract unsubscribe URLs (batched)                             */
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
  /* 6.  Insert tasks (dedup via @@unique)                              */
  /* ------------------------------------------------------------------ */
  const tasks = await createTasks(prisma, user.id, urls);

  /* ------------------------------------------------------------------ */
  /* 7.  Persist refreshed access‑token                                 */
  /* ------------------------------------------------------------------ */
  await prisma.user.update({
    where: { id: user.id },
    data: {
      googleAccessToken: user.googleAccessToken,
      googleTokenExpiry: user.googleTokenExpiry,
    },
  });

  return reply.send({ created: tasks.length });
}
