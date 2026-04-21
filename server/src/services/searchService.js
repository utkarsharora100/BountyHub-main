const bountyRepository = require('../repositories/bountyRepository');
const { redis, cacheGet } = require('../config/redis');

const INDEX_KEYS = {
  active: 'search:index:active',
  ready: 'search:index:ready',
  suggestions: 'search:suggestions',
  unmetDemand: 'search:unmet-demand',
};

function normalize(term) {
  return String(term || '').toLowerCase().trim();
}

function tokenize(text) {
  return normalize(text)
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 2);
}

function prefixesForToken(token) {
  const prefixes = [];
  const max = Math.min(token.length, 32);
  for (let i = 2; i <= max; i += 1) {
    prefixes.push(token.slice(0, i));
  }
  return prefixes;
}

function getBountyTokens(bounty) {
  return [
    ...tokenize(bounty.title),
    ...tokenize(bounty.description),
    ...tokenize(bounty.category),
    ...tokenize(bounty.department),
    ...(Array.isArray(bounty.skills) ? bounty.skills.flatMap(tokenize) : []),
    ...tokenize(bounty.creator?.university?.name),
  ];
}

function docKey(id) {
  return `search:bounty:${id}`;
}

function prefixKey(prefix) {
  return `search:prefix:${prefix}`;
}

function tempKey(tokens) {
  return `search:tmp:${tokens.join(':')}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
}

function isIndexable(bounty) {
  return bounty
    && bounty.status === 'OPEN'
    && (!bounty.deadline || new Date(bounty.deadline) > new Date());
}

async function collectKeys(pattern) {
  const keys = [];
  let cursor = '0';
  do {
    const [nextCursor, batch] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 500);
    cursor = nextCursor;
    keys.push(...batch);
  } while (cursor !== '0');
  return keys;
}

const searchService = {
  async addSearchSuggestion(term) {
    if (!redis || !term || term.length < 2) return;
    try {
      const normalized = normalize(term);
      await redis.zincrby(INDEX_KEYS.suggestions, 1, normalized);
      const count = await redis.zcard(INDEX_KEYS.suggestions);
      if (count > 1000) {
        await redis.zremrangebyrank(INDEX_KEYS.suggestions, 0, count - 1001);
      }
    } catch {
      // Suggestion tracking is best-effort.
    }
  },

  async logUnmetDemand(term) {
    if (!redis || !term || term.length < 2) return;
    try {
      const normalized = normalize(term);
      const day = new Date().toISOString().slice(0, 10);
      await redis
        .multi()
        .zincrby(INDEX_KEYS.unmetDemand, 1, normalized)
        .hincrby(`search:unmet-demand:${day}`, normalized, 1)
        .expire(`search:unmet-demand:${day}`, 60 * 60 * 24 * 90)
        .exec();
    } catch {
      // Analytics should never block search.
    }
  },

  async getUnmetDemand(limit = 25) {
    if (!redis) return [];
    const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 25, 1), 100);
    const rows = await redis.zrevrange(INDEX_KEYS.unmetDemand, 0, safeLimit - 1, 'WITHSCORES');
    const result = [];
    for (let i = 0; i < rows.length; i += 2) {
      result.push({ query: rows[i], count: parseInt(rows[i + 1], 10) || 0 });
    }
    return result;
  },

  async removeBountyFromIndex(bountyId) {
    if (!redis || !bountyId) return;
    const key = docKey(bountyId);
    const prefixesJson = await redis.hget(key, 'prefixes');
    const prefixes = prefixesJson ? JSON.parse(prefixesJson) : [];
    const pipeline = redis.pipeline();
    prefixes.forEach((prefix) => pipeline.zrem(prefixKey(prefix), String(bountyId)));
    pipeline.zrem(INDEX_KEYS.active, String(bountyId));
    pipeline.del(key);
    await pipeline.exec();
  },

  async indexBounty(bounty) {
    if (!redis || !bounty?.id) return;
    await this.removeBountyFromIndex(bounty.id);
    if (!isIndexable(bounty)) return;

    const uniquePrefixes = [...new Set(getBountyTokens(bounty).flatMap(prefixesForToken))];
    const payload = {
      id: String(bounty.id),
      title: bounty.title,
      description: bounty.description,
      category: bounty.category,
      department: bounty.department || '',
      skills: JSON.stringify(bounty.skills || []),
      rewardPoints: String(bounty.rewardPoints),
      createdAt: new Date(bounty.createdAt).getTime().toString(),
      deadline: bounty.deadline ? new Date(bounty.deadline).getTime().toString() : '',
      prefixes: JSON.stringify(uniquePrefixes),
    };
    const score = new Date(bounty.createdAt).getTime();

    const pipeline = redis.pipeline();
    pipeline.hset(docKey(bounty.id), payload);
    pipeline.zadd(INDEX_KEYS.active, score, String(bounty.id));
    uniquePrefixes.forEach((prefix) => pipeline.zadd(prefixKey(prefix), score, String(bounty.id)));
    await pipeline.exec();
  },

  async rebuildBountyIndex() {
    if (!redis) return { indexed: 0 };
    const bounties = await bountyRepository.findIndexableForSearch();
    const keys = [
      ...(await collectKeys('search:prefix:*')),
      ...(await collectKeys('search:bounty:*')),
    ];
    const pipeline = redis.pipeline();
    keys.forEach((key) => pipeline.del(key));
    pipeline.del(INDEX_KEYS.active);
    pipeline.del(INDEX_KEYS.ready);
    await pipeline.exec();

    for (const bounty of bounties) {
      await this.indexBounty(bounty);
    }
    await redis.set(INDEX_KEYS.ready, '1');
    return { indexed: bounties.length };
  },

  async searchBounties(query, page = 1, limit = 10) {
    if (!redis || !query || query.trim().length < 2) return null;
    const isReady = await redis.get(INDEX_KEYS.ready);
    if (!isReady) return null;

    const tokens = [...new Set(tokenize(query).map((token) => token.slice(0, 32)))];
    if (tokens.length === 0) return { bounties: [], total: 0 };

    const keys = tokens.map((token) => prefixKey(token.slice(0, 32)));
    const safePage = Math.max(parseInt(page, 10) || 1, 1);
    const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 50);
    const offset = (safePage - 1) * safeLimit;
    const stop = offset + safeLimit - 1;

    let total;
    let ids;
    if (keys.length === 1) {
      [total, ids] = await Promise.all([
        redis.zcard(keys[0]),
        redis.zrevrange(keys[0], offset, stop),
      ]);
    } else {
      const destination = tempKey(tokens);
      await redis.zinterstore(destination, keys.length, ...keys, 'AGGREGATE', 'MAX');
      await redis.expire(destination, 10);
      [total, ids] = await Promise.all([
        redis.zcard(destination),
        redis.zrevrange(destination, offset, stop),
      ]);
    }

    if (total === 0) return { bounties: [], total: 0 };

    const pageIds = ids.map((id) => parseInt(id, 10));
    const bounties = await bountyRepository.findSearchResultsByIds(pageIds);
    const byId = new Map(bounties.map((bounty) => [bounty.id, bounty]));

    return {
      bounties: pageIds.map((id) => byId.get(id)).filter(Boolean),
      total,
    };
  },

  async getMatches(prefix, limit = 6) {
    if (!prefix || prefix.length < 2) return [];
    const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 6, 1), 12);
    const indexed = await this.searchBounties(prefix, 1, safeLimit);
    if (indexed) return indexed.bounties;

    const { bounties } = await bountyRepository.search(prefix, 0, safeLimit);
    return bounties;
  },

  async getSuggestions(prefix) {
    if (!redis || !prefix || prefix.length < 2) return [];

    const normalized = normalize(prefix);
    const cacheKey = `autocomplete:${normalized}`;
    return cacheGet(cacheKey, async () => {
      const popularSuggestions = await redis.zrevrange(INDEX_KEYS.suggestions, 0, 99);
      const filtered = popularSuggestions
        .filter((s) => s.startsWith(normalized))
        .slice(0, 8);

      if (filtered.length > 0) return filtered;

      const ids = await redis.zrevrange(prefixKey(normalized.slice(0, 32)), 0, 7);
      if (ids.length > 0) {
        const bounties = await bountyRepository.findSearchResultsByIds(
          ids.slice(0, 8).map((id) => parseInt(id, 10))
        );
        return bounties.map((b) => b.title.toLowerCase());
      }

      const { bounties } = await bountyRepository.search(prefix, 0, 8);
      return bounties.map((b) => b.title.toLowerCase());
    }, 120);
  },
};

module.exports = searchService;
