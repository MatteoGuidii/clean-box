import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import jwtPlugin from './plugins/jwt';
import oauthRoutes from './routes/oauthRoutes';
import userRoutes from './routes/user';
import taskRoutes from './routes/taskRoutes'; // --- IMPORT Task Routes ---
import { errorHandler } from './utils/errorHandler';

const app = Fastify();

// Register CORS, Cookie, JWT Plugin (order matters for dependencies)
app.register(cors, { origin: true, credentials: true });
app.register(cookie, { secret: process.env.COOKIE_SECRET! });
app.register(jwtPlugin); // JWT plugin must be registered before routes using app.authenticate

// Register your routes
app.register(userRoutes, { prefix: '/api/v1/users' });
app.register(oauthRoutes, { prefix: '/api/v1' });
app.register(taskRoutes, { prefix: '/api/v1' }); // --- REGISTER Task Routes ---

// Global error handler
app.setErrorHandler(errorHandler);

// Start server
const start = async () => {
  try {
    await app.listen({ port: 3000 });
    console.log('🚀 Server running on http://localhost:3000');
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};
start();