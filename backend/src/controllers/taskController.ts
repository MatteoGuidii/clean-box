// src/controllers/taskController.ts
import { FastifyRequest, FastifyReply } from 'fastify';
import prisma from '../db/prisma';
import { asyncHandler } from '../utils/asyncHandler';
import { unsubscribeQueue, UnsubscribeJobData } from '../queues/unsubscribeQueue'; // Import queue and JobData type

// --- Interfaces ---
interface GetTasksQuery {
  status?: string;
}

interface ApproveTasksBody {
  taskIds?: string[];
}

// Interface for URL parameters like taskId
interface TaskIdParam {
    taskId: string;
}


// --- Controller Functions ---

/**
 * Fetches UnsubscribeTasks for the authenticated user.
 * Filters by status query parameter if provided.
 */
export const getTasks = asyncHandler(async (req: FastifyRequest, reply: FastifyReply) => {
    const userId = req.userId;
    if (!userId) {
      return reply.status(401).send({ error: 'Unauthorized: User ID not found on request.' });
    }
    const { status } = req.query as GetTasksQuery;
    console.log(`[TaskController] Fetching tasks for user ${userId} with status filter: ${status || 'all'}`);

    const whereClause: any = { userId: userId };
    if (status && typeof status === 'string' && status.trim() !== '') {
      // Basic validation for status string
      whereClause.status = status.trim();
    }

    try {
      const tasks = await prisma.unsubscribeTask.findMany({
        where: whereClause,
        // Select fields needed by the frontend
        select: {
            id: true,
            url: true,
            senderEmail: true,
            status: true,
            createdAt: true,
            updatedAt: true
        },
        orderBy: { createdAt: 'desc' }, // Show newest first
      });
      console.log(`[TaskController] Found ${tasks.length} tasks for user ${userId} (status: ${status || 'all'})`);
      reply.send(tasks);
    } catch (error: unknown) {
      console.error(`[TaskController] Error fetching tasks for user ${userId}:`, error);
      reply.status(500).send({ error: 'Failed to retrieve tasks.' });
    }
});


/**
 * Approves tasks for unsubscribing (changes status and queues job).
 */
export const approveTasks = asyncHandler(async (req: FastifyRequest, reply: FastifyReply) => {
    const userId = req.userId;
    if (!userId) { return reply.status(401).send({ error: 'Unauthorized' }); }

    const { taskIds } = req.body as ApproveTasksBody;
    if (!Array.isArray(taskIds) || taskIds.length === 0) {
        return reply.status(400).send({ error: 'Invalid input: taskIds must be a non-empty array.' });
    }

    console.log(`[TaskController] Received approval request for ${taskIds.length} tasks from user ${userId}`);
    const results = { approved: [] as string[], notFound: [] as string[], invalidState: [] as string[], queueErrors: [] as string[], dbErrors: [] as string[] };

    for (const taskId of taskIds) {
        if (typeof taskId !== 'string' || !taskId) continue;
        try {
            // Fetch task, ensure ownership and correct status
            const task = await prisma.unsubscribeTask.findFirst({
                where: { id: taskId, userId: userId },
                select: { id: true, url: true, status: true }
            });

            if (!task) { results.notFound.push(taskId); continue; }
            if (task.status !== 'pending_approval') { results.invalidState.push(taskId); continue; }

            // Update status in DB
            try {
                await prisma.unsubscribeTask.update({
                    where: { id: taskId },
                    data: { status: 'queued', updatedAt: new Date() }, // Mark as queued for worker
                });
            } catch (dbError) {
                console.error(`[TaskController] Failed to update DB status for task ${taskId}:`, dbError);
                results.dbErrors.push(taskId);
                continue; // Don't queue if DB update failed
            }

            // Add job to queue
            try {
                const jobId = `task-${taskId}`; // Unique job ID
                // Ensure the job data matches the UnsubscribeJobData interface
                const jobData: UnsubscribeJobData = { taskId: task.id, url: task.url, userId: userId };
                await unsubscribeQueue.add('process-unsubscribe-url', jobData, { jobId: jobId });
                results.approved.push(taskId);
                console.log(`[TaskController] Added job ${jobId} to queue for approved task ${taskId}`);
            } catch (queueError) {
                console.error(`[TaskController] Failed to add job to queue for task ${taskId}:`, queueError);
                results.queueErrors.push(taskId);
                // Optional: Revert DB status?
            }
        } catch (error) {
             console.error(`[TaskController] Unexpected error processing approval for task ID ${taskId}:`, error);
             // Add to a generic error category or rethrow? For now, just log.
        }
    } // End for loop

    const totalProcessed = taskIds.length;
    const totalFailed = results.notFound.length + results.invalidState.length + results.queueErrors.length + results.dbErrors.length;
    const statusCode = totalFailed === 0 ? 200 : (results.approved.length > 0 ? 207 : 400); // OK, Multi-Status, or Bad Request

    reply.status(statusCode).send({
        message: `Processed ${totalProcessed} task approval(s). Approved & Queued: ${results.approved.length}, Failed: ${totalFailed}.`,
        details: results // Provide details of failures
    });
});


/**
 * Initiates a background job to scan the user's inbox.
 */
export const initiateScan = asyncHandler(async (req: FastifyRequest, reply: FastifyReply) => {
    const userId = req.userId;
    if (!userId) { return reply.status(401).send({ error: 'Unauthorized' }); }

    // Check connection status
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { isGmailConnected: true } });
    if (!user?.isGmailConnected) { return reply.status(400).send({ error: 'Gmail account is not connected.' }); }

    // Optional: Prevent queuing multiple scans too close together (add logic here if needed)

    try {
        const jobName = 'scan-inbox';
        const jobId = `scan-${userId}-${Date.now()}`; // Unique-ish job ID
        // Data needed by the scan worker
        const jobData: UnsubscribeJobData = { taskId: 'default-task-id', url: 'default-url', userId: userId };

        const job = await unsubscribeQueue.add(jobName, jobData, { jobId: jobId });

        console.log(`[TaskController] Added job ${job.id} (${jobName}) to queue for user ${userId}`);
        reply.status(202).send({ message: 'Inbox scan initiated. Check back later for tasks needing approval.' });

    } catch (error) {
        console.error(`[TaskController] Failed to add scan job for user ${userId}:`, error);
        reply.status(500).send({ error: 'Failed to initiate inbox scan.' });
    }
});


/**
 * Marks a specific task as 'ignored' (user wants to keep the subscription).
 */
export const ignoreTask = asyncHandler(async (req: FastifyRequest, reply: FastifyReply) => {
    const userId = req.userId;
    if (!userId) { return reply.status(401).send({ error: 'Unauthorized' }); }

    const { taskId } = req.params as TaskIdParam; // Get taskId from URL parameter
    if (!taskId) { return reply.status(400).send({ error: 'Missing taskId parameter.' }); }

    console.log(`[TaskController] Received ignore request for task ${taskId} from user ${userId}`);

    try {
        // Find the task, ensure ownership and 'pending_approval' status
        const task = await prisma.unsubscribeTask.findFirst({
            where: {
                id: taskId,
                userId: userId,
                status: 'pending_approval' // Can only ignore tasks pending approval
            },
            select: { id: true } // Just need ID to confirm existence and ownership
        });

        if (!task) {
            return reply.status(404).send({ error: 'Task not found or cannot be ignored (must be pending approval).' });
        }

        // Update status to 'ignored'
        await prisma.unsubscribeTask.update({
            where: { id: taskId },
            data: {
                status: 'ignored', // Set the new status
                updatedAt: new Date(),
            }
        });

        console.log(`[TaskController] Marked task ${taskId} as ignored for user ${userId}`);
        reply.status(200).send({ message: 'Subscription marked to be kept.' });

    } catch (error) {
        console.error(`[TaskController] Error ignoring task ${taskId} for user ${userId}:`, error);
        reply.status(500).send({ error: 'Failed to update task status.' });
    }
});

