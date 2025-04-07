import Fastify from 'fastify';
import cors from '@fastify/cors';
import userRoutes from './routes/user';

import dotenv from 'dotenv';

dotenv.config();
const app = Fastify();

app.register(cors, { origin: true });
app.register(userRoutes, { prefix: '/api/v1/users' });

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
