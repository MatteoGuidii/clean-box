import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import jwtPlugin from './plugins/jwt';
import userRoutes from './routes/user';
import { errorHandler } from './utils/errorHandler';

import dotenv from 'dotenv';

dotenv.config();
const app = Fastify();

// Register CORS
app.register(cors, { origin: true, credentials: true });

// Cookie parser
app.register(cookie, {
  secret: process.env.COOKIE_SECRET!,
});

// JWT decorator
app.register(jwtPlugin);

//  Register your routes
app.register(userRoutes, { prefix: '/api/v1/users' });

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
