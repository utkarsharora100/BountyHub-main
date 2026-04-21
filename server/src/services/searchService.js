// ─── Search Service (with Redis autocomplete caching) ────────
const bountyRepository = require('../repositories/bountyRepository');
const { redis, redisRead, cacheGet } = require('../config/redis');

const searchService = {
  // Store search suggestions in Redis sorted set
  async addSearchSuggestion(term) {
    if (!redis || !term || term.length < 2) return;
    try {
      const normalized = term.toLowerCase().trim();
      await redis.zincrby('search:suggestions', 1, normalized);
      // Keep only top 1000 suggestions
      const count = await redis.zcard('search:suggestions');
      if (count > 1000) {
        await redis.zremrangebyrank('search:suggestions', 0, count - 1001);
      }
    } catch {
      // ignore
    }
  },

  // Get autocomplete suggestions
  async getSuggestions(prefix) {
    if (!redis || !prefix || prefix.length < 2) return [];

    const cacheKey = `autocomplete:${prefix.toLowerCase()}`;
    return cacheGet(cacheKey, async () => {
      // Get all suggestions and filter by prefix (simple approach)
      const allSuggestions = await redis.zrevrange('search:suggestions', 0, 99);
      const filtered = allSuggestions
        .filter((s) => s.startsWith(prefix.toLowerCase()))
        .slice(0, 8);

      if (filtered.length > 0) return filtered;

      // Fallback: query database for matching bounty titles
      const { bounties } = await bountyRepository.search(prefix, 0, 8);
      return bounties.map((b) => b.title.toLowerCase());
    }, 600);
  },
  // Track search queries that returned zero results — useful for demand analytics
  async trackUnmetDemand(query) {
    if (!redis || !query || query.trim().length < 2) return;
    try {
      await redis.zincrby('unmet:demand', 1, query.toLowerCase().trim());
    } catch {
      // ignore
    }
  },

  // Return the top N unmet demand terms (zero-result searches)
  async getUnmetDemand(limit = 20) {
    if (!redisRead) return [];
    try {
      const raw = await redisRead.zrevrange('unmet:demand', 0, limit - 1, 'WITHSCORES');
      const result = [];
      for (let i = 0; i < raw.length; i += 2) {
        result.push({ term: raw[i], count: parseInt(raw[i + 1], 10) });
      }
      return result;
    } catch {
      return [];
    }
  },
};

module.exports = searchService;
