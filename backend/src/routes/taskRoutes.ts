    // src/routes/taskRoutes.ts
    import { FastifyInstance } from 'fastify';
    // Import ALL controller functions needed
    import { getTasks, approveTasks, initiateScan, ignoreTask } from '../controllers/taskController';
    import { asyncHandler } from '../utils/asyncHandler';

    export default async function taskRoutes(app: FastifyInstance) {

      // GET /tasks endpoint (existing)
      app.get('/tasks', { preHandler: [app.authenticate] }, asyncHandler(getTasks));

      // POST /tasks/approve endpoint (existing)
      app.post('/tasks/approve', { preHandler: [app.authenticate] }, asyncHandler(approveTasks));

      // POST /scan/initiate endpoint (existing)
      app.post('/scan/initiate', { preHandler: [app.authenticate] }, asyncHandler(initiateScan));

      // --- ADDED: POST /tasks/:taskId/ignore endpoint ---
      // Using POST or PATCH is suitable for updating status
      app.post(
          '/tasks/:taskId/ignore', // Route with URL parameter for task ID
          {
              preHandler: [app.authenticate] // Requires authentication
          },
          asyncHandler(ignoreTask) // Use the new controller function
      );
      // --- END ADD ---

    }
    