// ─── Prisma Client with Master + Read Replica Pattern ──────────
// Master: used for writes (INSERT, UPDATE, DELETE)
// Read Replica: used for reads (SELECT) to distribute load

const { PrismaClient } = require('@prisma/client');
const config = require('./index');

// Master client – for all write operations
const prisma = new PrismaClient({
  datasources: { db: { url: config.db.url } },
  log: config.nodeEnv === 'development' ? ['query', 'error'] : ['error'],
});

// Read replica client – for read-heavy operations
const prismaRead = new PrismaClient({
  datasources: { db: { url: config.db.readUrl } },
  log: config.nodeEnv === 'development' ? ['error'] : ['error'],
});

module.exports = { prisma, prismaRead };
