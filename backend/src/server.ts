import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import jwtPlugin from './plugins/jwt';

import oauthRoutes from './routes/oauthRoutes';
import userRoutes from './routes/user';
import scanRoutes from './routes/scanRoutes';
import statsRoutes from './routes/statsRoutes';

import { errorHandler } from './utils/errorHandler';
import dotenv from 'dotenv';

dotenv.config();

const app = Fastify({ logger: true });          // pretty logs in dev

/* ─────────── Plugins ─────────── */
app.register(cors, { origin: true, credentials: true });
app.register(cookie, { secret: process.env.COOKIE_SECRET! });
app.register(jwtPlugin);

/* ─────────── Routes ─────────── */
app.register(userRoutes, { prefix: '/api/v1/users' });
app.register(oauthRoutes, { prefix: '/api/v1' });
app.register(scanRoutes, { prefix: '/api/v1' }); 
app.register(statsRoutes, { prefix: '/api/v1'}); 

/* ─────────── Error handler ───── */
app.setErrorHandler(errorHandler);

/* ─────────── Start server ────── */
const start = async () => {
  try {
    await app.listen({ port: 3000, host: '0.0.0.0' });
    console.log('🚀  Server running on http://localhost:3000');
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
