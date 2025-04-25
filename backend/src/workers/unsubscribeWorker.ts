// src/workers/unsubscribeWorker.ts
import { Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { UNSUBSCRIBE_QUEUE_NAME, UnsubscribeJobData, UnsubscribeJobResult } from '../queues/unsubscribeQueue'; // Import queue name and types
import prisma from '../db/prisma';
import { scanInboxAndCreateTasks } from '../services/gmailService'; // Import the scan function

// --- Redis Connection Setup --- (Ensure env vars are loaded via preload or server.ts)
const redisHost = process.env.REDIS_HOST || '127.0.0.1';
const redisPort = parseInt(process.env.REDIS_PORT || '6379', 10);
const redisPassword = process.env.REDIS_PASSWORD;

const connection = new IORedis({
    host: redisHost, port: redisPort, password: redisPassword, maxRetriesPerRequest: null, enableReadyCheck: true,
});
connection.on('connect', () => console.log('[Worker] Connected to Redis.'));
connection.on('error', (err) => console.error('[Worker] Redis connection error:', err));
// -----------------------------


// --- Define the Combined Job Processor Function ---
// This function handles different job names based on job.name
const processJob = async (job: Job<UnsubscribeJobData | { userId: string }, UnsubscribeJobResult | any, string>) => {
    console.log(`[Worker] Processing job ${job.id} with name "${job.name}"`);

    // --- Handle 'scan-inbox' Job ---
    if (job.name === 'scan-inbox') {
        const { userId } = job.data as { userId: string }; // Type assertion for scan job data
        console.log(`[Worker] Starting inbox scan for user ${userId} (Job ${job.id})`);
        try {
            // Call the existing scan function
            const scanResult = await scanInboxAndCreateTasks(userId);
            console.log(`[Worker] Scan completed for user ${userId} (Job ${job.id}): Processed=${scanResult.processed}, Created=${scanResult.created}, Errors=${scanResult.errors}`);
            return scanResult; // Return scan results
        } catch (error: any) {
            console.error(`[Worker] Inbox scan failed for user ${userId} (Job ${job.id}):`, error.message || error);
            // Throw error so BullMQ marks job as failed and handles retries
            throw error;
        }
    }

    // --- Handle 'process-unsubscribe-url' Job ---
    else if (job.name === 'process-unsubscribe-url') {
        const { taskId, url, userId } = job.data as UnsubscribeJobData; // Type assertion for unsubscribe job data
        console.log(`[Worker] Processing unsubscribe task ${taskId} for user ${userId}: URL ${url}`);

        try {
            // 1. Update task status to 'processing' in DB
            await prisma.unsubscribeTask.update({
                where: { id: taskId },
                data: { status: 'processing', updatedAt: new Date() }
            });

            // --- TODO: Implement Playwright, Claude AI Logic Here ---
            //    - Launch Playwright
            //    - Navigate to url
            //    - Extract DOM
            //    - Call Claude API
            //    - Parse response
            //    - Execute Playwright actions
            //    - Determine success/failure
            console.log(`[Worker] TODO: Implement Playwright/AI for ${url}`);
            await new Promise(resolve => setTimeout(resolve, 3000)); // Simulate work
            const outcome = Math.random() > 0.3 ? 'success' : 'failed'; // Simulate outcome
            // ---------------------------------------------------------

            // 2. Update task status based on outcome
            await prisma.unsubscribeTask.update({
                where: { id: taskId },
                data: { status: outcome, updatedAt: new Date() }
            });

            console.log(`[Worker] Unsubscribe task ${taskId} completed with status: ${outcome}`);
            return { status: outcome }; // Return result

        } catch (error: any) {
            console.error(`[Worker] Unsubscribe task ${taskId} failed:`, error.message || error);
            // Update task status to 'failed' in DB on error
            try {
                 await prisma.unsubscribeTask.update({
                     where: { id: taskId },
                     data: { status: 'failed', updatedAt: new Date() }
                 });
            } catch (dbError) {
                 console.error(`[Worker] Failed to update task ${taskId} status to failed in DB:`, dbError);
            }
            // Throw error for BullMQ retry logic
            throw error;
        }
    }

    // --- Handle Unknown Job Names ---
    else {
        console.warn(`[Worker] Unknown job name received: ${job.name}. Skipping job ${job.id}.`);
        throw new Error(`Unknown job name: ${job.name}`); // Fail the job explicitly
    }
};

// --- Initialize the Worker ---
const worker = new Worker(UNSUBSCRIBE_QUEUE_NAME, processJob, {
    connection: connection.duplicate(), // Use duplicated connection
    concurrency: 5, // Adjust concurrency based on resources
});

// --- Worker Event Listeners --- (remain the same)
worker.on('completed', (job, result) => { /* ... */ });
worker.on('failed', (job, err) => { /* ... */ });
worker.on('error', err => { /* ... */ });
worker.on('active', job => { /* ... */ });

console.log(`[Worker] Unsubscribe worker initialized for queue "${UNSUBSCRIBE_QUEUE_NAME}". Waiting for jobs...`);

// --- Graceful Shutdown --- (remains the same)
const gracefulShutdown = async () => { /* ... */ };
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
