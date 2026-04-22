const { PrismaClient } = require('@prisma/client');

const requireSeededData = process.argv.includes('--seeded');
const url = process.env.DATABASE_READ_URL || process.env.DATABASE_URL;
const maxAttempts = parseInt(process.env.READ_MODEL_WAIT_ATTEMPTS || '40', 10);
const delayMs = parseInt(process.env.READ_MODEL_WAIT_MS || '1500', 10);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const prisma = new PrismaClient({
    datasources: { db: { url } },
  });

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const universityCount = await prisma.university.count();
      if (!requireSeededData || universityCount > 0) {
        await prisma.$disconnect();
        return;
      }
    } catch {
      // Schema has not reached the read model yet.
    }

    await sleep(delayMs);
  }

  await prisma.$disconnect();
  const target = requireSeededData ? 'seeded data' : 'schema';
  throw new Error(`Timed out waiting for read replica ${target}`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
