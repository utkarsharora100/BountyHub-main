// ─── Cache Warmer ─────────────────────────────────────────────
// Runs once on server startup. Populates Redis so the first real
// user request hits cache instead of PostgreSQL.
const { prismaRead } = require('../config/database');
const { redis, cacheGet } = require('../config/redis');
const bountyRepository = require('../repositories/bountyRepository');
const logger = require('./logger');

function extractTerms(text) {
  if (!text) return [];
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3);
}

async function warmSearchSuggestions() {
  if (!redis) return;

  const existing = await redis.zcard('search:suggestions');
  if (existing >= 100) {
    logger.info('[warmer] search:suggestions already populated, skipping');
    return;
  }

  const bounties = await prismaRead.bounty.findMany({
    select: { title: true, category: true, description: true },
    take: 1000,
  });

  const pipeline = redis.pipeline();
  const seen = new Set();

  for (const b of bounties) {
    const titleNorm = b.title.toLowerCase().trim();
    if (titleNorm.length >= 2 && !seen.has(titleNorm)) {
      pipeline.zincrby('search:suggestions', 5, titleNorm);
      seen.add(titleNorm);
    }

    const terms = [
      ...extractTerms(b.title),
      ...extractTerms(b.description?.slice(0, 200) ?? ''),
      b.category?.toLowerCase(),
    ].filter(Boolean);

    for (const term of terms) {
      if (!seen.has(term)) {
        pipeline.zincrby('search:suggestions', 1, term);
        seen.add(term);
      }
    }
  }

  await pipeline.exec();
  logger.info(`[warmer] seeded search:suggestions with ${seen.size} terms`);
}

async function warmBountyListCache() {
  try {
    await Promise.all([
      cacheGet(
        'bounties:list:{"skip":0,"take":10,"where":{},"sortBy":undefined}',
        () => bountyRepository.findMany({ skip: 0, take: 10, where: {}, orderBy: { createdAt: 'desc' } }),
        600
      ),
      cacheGet('trending:bounties', () => bountyRepository.getTrending(10), 600),
    ]);
    logger.info('[warmer] bounty list and trending cache warmed');
  } catch (err) {
    logger.warn('[warmer] bounty list warm failed:', err.message);
  }
}

async function warmAll() {
  try {
    await Promise.all([warmSearchSuggestions(), warmBountyListCache()]);
    logger.info('[warmer] cache warm complete');
  } catch (err) {
    logger.warn('[warmer] cache warm error (non-fatal):', err.message);
  }
}

module.exports = { warmAll };
