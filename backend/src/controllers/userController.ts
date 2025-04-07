import { FastifyRequest, FastifyReply } from 'fastify';
import { createUserSession } from '../utils/auth';
import prisma from '../db/prisma';
import argon2 from 'argon2';

// Define the shape of req.body for signup
interface SignupBody {
  email: string; // required
  password: string; // required
  name?: string; // optional
}

// Define the shape of req.body for login
interface LoginBody {
  email: string; // required
  password: string; // required
}

export async function signup(req: FastifyRequest, reply: FastifyReply) {
  // 1. Destructure with our SignupBody interface
  const { email, password, name } = req.body as SignupBody;

  // 2. Runtime validation (in case someone sends bad JSON)
  if (!email || !password) {
    // 400 error: Bad Request
    return reply.status(400).send({ error: 'Email and password are required.' });
  }

  // 3. Check if user already exists
  const existing = await prisma.user.findUnique({
    where: { email },
  });
  if (existing) {
    // 409 error: Request could not be completed due to a conflict with the current state of the target resource
    // (e.g., trying to create a user with an email that already exists)
    return reply.status(409).send({ error: 'Email is already registered.' });
  }

  // 4. Hash the password
  const hashedPassword = await argon2.hash(password);

  // 5. Create the user record (name is optional)
  const user = await prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      name: name ?? null,
    },
  });

  // create the session cookie
  await createUserSession(reply, user.id);

  // 6. Strip password before returning
  // The ...userSafe part uses the rest operator to collect all the remaining properties of the user object (excluding password) into a new object called userSafe.
  const { password: _pw, ...userSafe } = user;
  // The 201 status code indicates that the request has been fulfilled and a new resource has been created.
  return reply.status(201).send(userSafe);
}

export async function login(req: FastifyRequest, reply: FastifyReply) {
  // 1. Destructure with our LoginBody interface
  const { email, password } = req.body as LoginBody;

  // 2. Runtime validation
  if (!email) {
    return reply.status(400).send({ error: 'Please provide your email address.' });
  }
  if (!password) {
    return reply.status(400).send({ error: 'Please provide your password.' });
  }

  // 3. Fetch the user by email
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    // 404 Not Found
    return reply.status(404).send({ error: 'No account found for that email.' });
  }

  // 4. Verify the password
  const valid = await argon2.verify(user.password, password);
  if (!valid) {
    // 401 Unauthorized
    return reply.status(401).send({ error: 'Incorrect password. Please try again.' });
  }

  // 5. Create the session cookie
  await createUserSession(reply, user.id);

  // 6. Strip password before returning
  const { password: _pw, ...userSafe } = user;
  return reply.send(userSafe);
}

export async function logout(req: FastifyRequest, reply: FastifyReply) {
  // Logs the user out by clearing the 'token' cookie.
  const isProd = process.env.NODE_ENV === 'production';

  // Clear the cookie named 'token'
  reply.clearCookie('token', {
    path: '/', // same path you set it on
    httpOnly: true, // match your createUserSession settings
    secure: isProd, // only over HTTPS in production
    sameSite: 'strict', // match your createUserSession settings
  });

  // Inform the client
  return reply.send({ message: 'Logged out successfully.' });
}

export async function getMe(req: FastifyRequest, reply: FastifyReply) {
  // request.userId is populated by authenticate hook
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
  });
  if (!user) {
    return reply.status(404).send({ error: 'User not found.' });
  }
  const { password, ...userSafe } = user;
  return reply.send(userSafe);
}
