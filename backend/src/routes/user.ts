import { FastifyInstance } from 'fastify';
import { signup, login, logout } from '../controllers/userController';

export default async function userRoutes(app: FastifyInstance) {
    app.post('/signup', signup);
	app.post('/login', login);
	app.post('/logout', logout);
}
