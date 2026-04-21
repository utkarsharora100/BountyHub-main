// ─── Redis Client Configuration ─────────────────────────────
const Redis = require('ioredis');
const config = require('./index');
const logger = require('../utils/logger');

let redis;
let redisRead;

try {
  redis = new Redis(config.redis.url, {
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
      if (times > 3) return null; // stop retrying
      return Math.min(times * 200, 2000);
    },
  });

  redis.on('connect', () => logger.info('Redis connected'));
  redis.on('error', (err) => logger.error('Redis error:', err.message));

  redisRead = new Redis(config.redis.readUrl, {
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
      if (times > 3) return null; // stop retrying
      return Math.min(times * 200, 2000);
    },
  });
  redisRead.on('connect', () => logger.info('Redis Read Replica connected'));
} catch (err) {
  logger.warn('Redis unavailable, caching disabled');
  redis = null;
  redisRead = null;
}

// Helper: get cached value or execute fetcher
async function cacheGet(key, fetcher, ttlSeconds = 300) {
  if (!redis) return fetcher();

  try {
    const cached = await redisRead.get(key); // Route read to replica
    if (cached) return JSON.parse(cached);
  } catch {
    // cache miss or error — fall through
  }

  const data = await fetcher();

  try {
    await redis.setex(key, ttlSeconds, JSON.stringify(data));
  } catch {
    // ignore cache write errors
  }

  return data;
}

// Helper: invalidate cache keys by pattern
async function cacheInvalidate(pattern) {
  if (!redis) return;
  try {
    const keys = await redis.keys(pattern);
    if (keys.length) await redis.del(...keys);
  } catch {
    // ignore
  }
}

module.exports = { redis, cacheGet, cacheInvalidate };
