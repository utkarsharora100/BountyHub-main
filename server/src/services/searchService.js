// ─── Search Service (with Redis autocomplete caching) ────────
const bountyRepository = require('../repositories/bountyRepository');
const { redis, cacheGet } = require('../config/redis');

const searchService = {
  // Store search suggestions in Redis sorted set
  async addSearchSuggestion(term) {
    if (!redis || !term || term.length < 2) return;
    try {
      const normalized = term.toLowerCase().trim();
      await redis.pipeline()
        .zincrby('search:suggestions', 1, normalized)
        // NX: only add to search:terms if not already present (score stays 0 for ZRANGEBYLEX)
        .zadd('search:terms', 'NX', 0, normalized)
        // Trim: keep only the top 1000 scored suggestions (ZREMRANGEBYRANK is safe when set is smaller)
        .zremrangebyrank('search:suggestions', 0, -1001)
        .exec();
    } catch {
      // ignore
    }
  },

  // Get autocomplete suggestions
  async getSuggestions(prefix) {
    if (!redis || !prefix || prefix.length < 2) return [];

    const cacheKey = `autocomplete:${prefix.toLowerCase()}`;
    return cacheGet(cacheKey, async () => {
      // ZRANGEBYLEX on search:terms (all members score=0) for O(log N) prefix scan
      const p = prefix.toLowerCase();
      const results = await redis.zrangebylex('search:terms', `[${p}`, `[${p}\xff`, 'LIMIT', 0, 8);

      if (results.length > 0) return results;

      // Fallback: lightweight title-only lookup.
      return bountyRepository.searchTitles(prefix, 8);
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
    if (!redis) return [];
    try {
      const raw = await redis.zrevrange('unmet:demand', 0, limit - 1, 'WITHSCORES');
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
