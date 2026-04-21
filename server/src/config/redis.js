// ─── Redis Client Configuration ─────────────────────────────
const Redis = require('ioredis');
const config = require('./index');
const logger = require('../utils/logger');

let redis;

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
} catch (err) {
  logger.warn('Redis unavailable, caching disabled');
  redis = null;
}

// Helper: get cached value or execute fetcher
async function cacheGet(key, fetcher, ttlSeconds = 300) {
  if (!redis) return fetcher();

  try {
    const cached = await redis.get(key);
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

// Helper: publish event to Redis Stream event bus
async function publishEvent(type, payload) {
  if (!redis) return;
  try {
    await redis.xadd('events:bounty', '*', 'type', type, 'data', JSON.stringify(payload));
  } catch {
    // ignore publish errors — do not fail the calling transaction
  }
}

module.exports = { redis, cacheGet, cacheInvalidate, publishEvent };
