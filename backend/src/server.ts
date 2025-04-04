import Fastify from 'fastify';
import dotenv from 'dotenv';

dotenv.config();
const app = Fastify();

app.get('/', async (req, res) => {
  return { status: 'Backend is running 🚀' };
});

app.listen({ port: 3000 }, () => {
  console.log('Server running on http://localhost:3000');
});
