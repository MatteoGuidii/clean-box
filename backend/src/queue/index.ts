/**
 * Centralised BullMQ queue definition.
 *
 * Any part of the backend that needs to enqueue unsubscribe‑tasks
 * should import { taskQueue } from this file rather than creating its
 * own Queue instance.  That way we share the same Redis connection
 * and configuration everywhere.
 */

import { Queue } from 'bullmq';
import IORedis from 'ioredis';

/* ------------------------------------------------------------------ */
/*  Redis connection                                                  */
/* ------------------------------------------------------------------ */
const connection = new IORedis(process.env.REDIS_URL as string, {
  // BullMQ requirement for blocking commands
  maxRetriesPerRequest: null,
});

/* ------------------------------------------------------------------ */
/*  Queue                                                             */
/* ------------------------------------------------------------------ */
export const taskQueue = new Queue('unsubscribe', {
  connection,
  defaultJobOptions: {
    attempts: 3,                                // retry a few times
    backoff: { type: 'exponential', delay: 5000 }, // 5 s, 10 s, 20 s …
    removeOnComplete: 500,                      // keep last 500 for logs
    removeOnFail: 1000,
  },
});

/* optional helper – enqueue a single task by id */
export function enqueueUnsubscribeTask(id: string) {
  return taskQueue.add('unsubscribe', { id });
}
