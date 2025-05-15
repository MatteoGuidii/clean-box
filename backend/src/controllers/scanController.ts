import type { FastifyRequest, FastifyReply } from 'fastify';
import prisma from '../db/prisma';

import {
  getAuthedGmail,
  listRecentMessageIds,
  getSenderAndUnsub,
  saveToDb,              
  enqueueNewTasks,
  type UnsubChannel,
} from '../services/google';

/**
 * POST /scan → discover List‑Unsubscribe links, persist them, enqueue jobs.
 * Response: { created: number }
 */
export async function startScan(req: FastifyRequest, reply: FastifyReply) {
  // 1 ▸ Auth guard ----------------------------------------------------------
  if (!req.userId) {
    return reply.code(401).send({ error: 'Unauthorized.' });
  }

  // 2 ▸ Load active Google account -----------------------------------------
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

  // 3 ▸ Gmail client (auto‑refresh) ----------------------------------------
  const gmail = await getAuthedGmail({
    googleRefreshToken: ga.refreshToken,
    googleAccessToken: ga.accessToken,
    googleTokenExpiry: ga.tokenExpiry,
  });

  // 4 ▸ Pull recent message IDs --------------------------------------------
  const ids = await listRecentMessageIds(gmail);
  if (!ids.length) return reply.send({ created: 0 });

  // 5 ▸ Extract sender + unsubscribe channels ------------------------------
  const rows: { senderName: string | null; channels: UnsubChannel[] }[] = [];
  const BATCH = 20;

  for (let i = 0; i < ids.length; i += BATCH) {
    const slice  = ids.slice(i, i + BATCH);
    const parts  = await Promise.all(slice.map(id => getSenderAndUnsub(gmail, id)));
    for (const p of parts) {
      if (!p) continue; // filtered out by age or missing header
      for (const channel of p.channels) {
        const existing = rows.find(row => row.senderName === p.senderName);
        if (existing) {
          existing.channels.push(channel);
        } else {
          rows.push({ senderName: p.senderName, channels: [channel] });
        }
      }
    }
  }
  if (!rows.length) return reply.send({ created: 0 });

  // 6 ▸ Persist to DB -------------------------------------------------------
  const tasks = await saveToDb(prisma, ga.id, rows);

  // 7 ▸ Queue new jobs ------------------------------------------------------
  await enqueueNewTasks(tasks);

  // 8 ▸ Save refreshed token -----------------------------------------------
  await prisma.googleAccount.update({
    where: { id: ga.id },
    data: { accessToken: ga.accessToken, tokenExpiry: ga.tokenExpiry },
  });

  return reply.send({ created: tasks.length });
}
