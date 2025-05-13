import 'dotenv/config';
import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import prisma from './db/prisma';

const connection = new IORedis(process.env.REDIS_URL as string, {
  maxRetriesPerRequest: null, 
});

const worker = new Worker(
  'unsubscribe',
  async job => {
    /* --- mock processing --- */
    const { id } = job.data as { id: string };
    await prisma.unsubscribeTask.update({
      where: { id },
      data: { status: 'processing' },
    });
    await new Promise(r => setTimeout(r, 2000));
    const success = Math.random() > 0.2;
    await prisma.unsubscribeTask.update({
      where: { id },
      data: { status: success ? 'success' : 'failed' },
    });
  },
  { connection },
);

worker.on('completed', job => console.log('✅', job.id));
worker.on('failed', (job, err) => console.error('❌', job?.id, err));
