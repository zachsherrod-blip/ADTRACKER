import { PrismaClient } from '@prisma/client';
import path from 'path';

const dbPath = process.env.DB_PATH ?? './data/app.db';

// Resolve relative to cwd
const absoluteDbPath = path.isAbsolute(dbPath)
  ? dbPath
  : path.join(process.cwd(), dbPath);

// Ensure the data directory exists
import fs from 'fs';
const dir = path.dirname(absoluteDbPath);
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

// Set DATABASE_URL if not already set (for Prisma)
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = `file:${absoluteDbPath}`;
}

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

export const prisma: PrismaClient =
  global.__prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  global.__prisma = prisma;
}

export default prisma;
