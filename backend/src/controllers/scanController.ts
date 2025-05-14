import type { FastifyRequest, FastifyReply } from 'fastify';
import prisma from '../db/prisma';

import {
  getAuthedGmail,
  listRecentMessageIds,
  getSenderAndUnsub,  
  createTasks,
  enqueueNewTasks,    
} from '../services/google';

/**
 * POST /scan  → discover recent List‑Unsubscribe links for the
 * active Gmail and enqueue tasks.
 */
export async function startScan(
  req: FastifyRequest,
  reply: FastifyReply,
) {
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
  /* 3. Gmail client (auto‑refresh token)                               */
  /* ------------------------------------------------------------------ */
  const gmail = await getAuthedGmail({
    googleRefreshToken: ga.refreshToken,
    googleAccessToken: ga.accessToken,
    googleTokenExpiry: ga.tokenExpiry,
  });

  /* ------------------------------------------------------------------ */
  /* 4. List candidate message IDs                                      */
  /* ------------------------------------------------------------------ */
  const ids = await listRecentMessageIds(gmail);
  if (!ids.length) return reply.send({ created: 0 });

  /* ------------------------------------------------------------------ */
  /* 5. Extract { sender, url } in batches                              */
  /* ------------------------------------------------------------------ */
  const rows: { sender: string | null; url: string }[] = [];
  const BATCH = 10;

  for (let i = 0; i < ids.length; i += BATCH) {
    const slice = ids.slice(i, i + BATCH);
    const parts = await Promise.all(
      slice.map(id => getSenderAndUnsub(gmail, id)),
    );
    for (const p of parts) {
      if (p.url) rows.push({ sender: p.sender, url: p.url });
    }
  }
  if (!rows.length) return reply.send({ created: 0 });

  /* ------------------------------------------------------------------ */
  /* 6. Insert tasks (@@unique dedups)                                  */
  /* ------------------------------------------------------------------ */
  const tasks = await createTasks(prisma, ga.id, rows);

  /* ------------------------------------------------------------------ */
  /* 7. Enqueue new tasks for the worker                                */
  /* ------------------------------------------------------------------ */
  await enqueueNewTasks(tasks);

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
