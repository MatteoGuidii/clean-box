/* ------------------------------------------------------------------ */
/*  worker.ts — BullMQ consumer                                       */
/* ------------------------------------------------------------------ */

import 'dotenv/config';
import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import prisma from './db/prisma';

/* ---------- Redis connection -------------------------------------- */
const connection = new IORedis(process.env.REDIS_URL!, {
  maxRetriesPerRequest: null,
});

/* ---------- helper: simulate the real HTTP/mailto call ------------ */
/* Replace this with your actual unsubscribe implementation.          */
async function performUnsubscribe(taskId: string): Promise<void> {
  await new Promise(r => setTimeout(r, 2_000)); // mock latency
  if (Math.random() < 0.2) {
    throw new Error('Mock network error');
  }
}

/* ------------------------------------------------------------------ */
/*  BullMQ Worker                                                     */
/* ------------------------------------------------------------------ */
const worker = new Worker(
  'unsubscribe',
  async job => {
    const { id } = job.data as { id: string };

    /* 1 ▸ mark task “processing” (quick op, no txn needed) -------- */
    await prisma.unsubscribeTask.update({
      where: { id },
      data: { status: 'processing', startedAt: new Date() },
    });

    /* 2 ▸ run the unsubscribe call — catch any error ------------- */
    let success = false;
    let errorMessage: string | null = null;
    try {
      await performUnsubscribe(id);
      success = true;
    } catch (err: any) {
      errorMessage = err?.message ?? 'Unknown error';
    }

    /* 3 ▸ atomically update task + (if success) subscription ------ */
    await prisma.$transaction(async tx => {
      /* 3a ▸ update task row */
      await tx.unsubscribeTask.update({
        where: { id },
        data: {
          status: success ? 'success' : 'failed',
          finishedAt: new Date(),
          errorMessage,
        },
      });

      /* 3b ▸ if success, flag the subscription */
      if (success) {
        const { subscriptionId } = await tx.unsubscribeTask.findUniqueOrThrow({
          where: { id },
          select: { subscriptionId: true },
        });

        await tx.subscription.update({
          where: { id: subscriptionId },
          data: {
            isUnsubscribed: true,
            unsubscribedAt: new Date(),
            lastSeen: new Date(), // keeps “recently processed” order
          },
        });
      }
    });
  },
  { connection },
);

/* ---------- worker events ----------------------------------------- */
worker.on('completed', job => console.log('✅ job', job.id));
worker.on('failed', (job, err) => console.error('❌ job', job?.id, err));
