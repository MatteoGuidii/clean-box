/**
 * This file exports a single shared PrismaClient instance.
 * Using a single instance throughout the app ensures we
 * reuse the same connection pool and avoid exhausting
 * database connections. Import this module wherever you
 * need to interact with the database.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default prisma;
