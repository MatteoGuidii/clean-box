// src/queues/unsubscribeQueue.ts
import { Queue, QueueOptions, Job, QueueListener } from 'bullmq'; // Import Job and QueueListener types
import IORedis from 'ioredis';

// --- Redis Connection Configuration ---
const redisHost = process.env.REDIS_HOST || '127.0.0.1';
const redisPort = parseInt(process.env.REDIS_PORT || '6379', 10);
const redisPassword = process.env.REDIS_PASSWORD;

if (!process.env.REDIS_HOST || !process.env.REDIS_PORT) {
    console.warn(`WARN: Missing REDIS_HOST or REDIS_PORT environment variables. Using default ${redisHost}:${redisPort}.`);
}

const connectionOptions = {
    host: redisHost,
    port: redisPort,
    password: redisPassword,
    maxRetriesPerRequest: null
};

// --- Queue Definition ---
export const UNSUBSCRIBE_QUEUE_NAME = 'unsubscribe-tasks';

// --- Define Job Data and Result Interfaces ---
export interface UnsubscribeJobData {
    taskId: string;
    url: string;
    userId: string;
}

export interface UnsubscribeJobResult {
    status: 'success' | 'failed';
    message?: string;
}

// --- Queue Options (Not Generic) ---
const queueOptions: QueueOptions = {
    connection: connectionOptions,
    defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: { count: 1000, age: 24 * 60 * 60 },
        removeOnFail: { count: 5000, age: 7 * 24 * 60 * 60 }
    },
};

// --- Create and Export Explicitly Typed Queue Instance ---
export const unsubscribeQueue = new Queue<UnsubscribeJobData, UnsubscribeJobResult, string>(
    UNSUBSCRIBE_QUEUE_NAME,
    queueOptions
);

console.log(`[Queue] BullMQ queue "${UNSUBSCRIBE_QUEUE_NAME}" initialized. Attempting connection to Redis at ${redisHost}:${redisPort}...`);

// --- Define Listener Type Alias for Clarity ---
// Define the specific listener type based on our JobData and JobResult
type UnsubscribeQueueListener = QueueListener<Job<UnsubscribeJobData>>;

// --- Event Listeners (with explicit casting of event names) ---

unsubscribeQueue.on('error', (error: Error) => {
  console.error(`[Queue] Error on queue "${UNSUBSCRIBE_QUEUE_NAME}":`, error);
});

// 'waiting' provides jobId (string) and previous status (string | undefined)
unsubscribeQueue.on('waiting' as keyof UnsubscribeQueueListener, (job: Job<UnsubscribeJobData, UnsubscribeJobResult, string> /*, prev?: string */) => {
  // console.log(`[Queue] Job ${job.id} is waiting`);
});

// 'active' provides the Job object and previous status
unsubscribeQueue.on('active' as keyof UnsubscribeQueueListener, (job: Job<UnsubscribeJobData, UnsubscribeJobResult, string> /*, prev?: string */) => {
  // console.log(`[Queue] Job ${job.id} is active`);
});

// 'completed' provides the Job object and the result
unsubscribeQueue.on('completed' as keyof UnsubscribeQueueListener, async (job: Job<UnsubscribeJobData, UnsubscribeJobResult, string>) => {
  console.log(`[Queue] Job ${job.id} completed with result:`, job.returnvalue);
});

// 'failed' provides the Job object (or undefined) and the error
unsubscribeQueue.on('failed' as keyof UnsubscribeQueueListener, (job: Job<UnsubscribeJobData, UnsubscribeJobResult, string>) => {
    if (job.failedReason) {
      console.error(`[Queue] Job ${job.id} failed after ${job.attemptsMade} attempts:`, job.failedReason);
    }
  });

