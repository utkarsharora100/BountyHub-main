// ─── Redis Client Configuration ─────────────────────────────
const Redis = require('ioredis');
const config = require('./index');
const logger = require('../utils/logger');

// maxRetriesPerRequest: 1 — each command gets one retry then rejects immediately
//   (no queueing while reconnecting, no hanging callers).
// enableOfflineQueue: false — commands issued while disconnected fail immediately
//   so try/catch fallbacks in cacheGet/cacheInvalidate/publishEvent fire right away.
// retryStrategy without a cap — connection retries forever with backoff so the
//   client self-heals when Redis comes back without needing a server restart.
//   Returning null here would put ioredis into a permanent "broken" state where
//   every subsequent command throws, which is silently swallowed and looks like
//   Redis is up but caching/events are silently dead.
function makeClient(url, label) {
  const client = new Redis(url, {
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    retryStrategy(times) {
      return Math.min(times * 300, 5000);
    },
  });
  client.on('connect', () => logger.info(`${label} connected`));
  client.on('error', (err) => logger.warn(`${label} error: ${err.message}`));
  client.on('end', () => logger.warn(`${label} connection closed — will retry`));
  return client;
}

let redis    = config.redis.url    ? makeClient(config.redis.url,     'Redis master')  : null;
let redisRead = config.redis.readUrl ? makeClient(config.redis.readUrl, 'Redis replica') : null;

// Helper: get cached value or execute fetcher
async function cacheGet(key, fetcher, ttlSeconds = 300) {
  if (!redis) return fetcher();

  try {
    const cached = redisRead ? await redisRead.get(key) : await redis.get(key);
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

module.exports = { redis, redisRead, cacheGet, cacheInvalidate, publishEvent };
