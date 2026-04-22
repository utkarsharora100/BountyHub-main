const { BountyCatalog } = require('../config/Document');

const discoveryService = {
  // Cross-university full-text search. Returns null when MongoDB is unavailable
  // so callers can fall back to PostgreSQL.
  // No university_id filter here — this is intentional scatter-gather for global search.
  async search(query, skip = 0, limit = 10) {
    if (!BountyCatalog) return null;

    try {
      const criteria = { status: { $ne: 'CANCELLED' } };
      if (query && query.trim()) {
        // By default MongoDB $text treats multi-word queries as OR ("machine learning"
        // returns docs with either word).  Wrapping each word in double-quotes makes
        // every word required (AND semantics) without disabling stemming entirely.
        const mandatoryQuery = query.trim().split(/\s+/).map(w => `"${w}"`).join(' ');
        criteria.$text = { $search: mandatoryQuery };
      }

      const [docs, total] = await Promise.all([
        BountyCatalog.find(criteria)
          .read('secondaryPreferred')
          .skip(skip)
          .limit(limit)
          .sort(query ? { score: { $meta: 'textScore' } } : { createdAt: -1 })
          .exec(),
        BountyCatalog.countDocuments(criteria).read('secondaryPreferred'),
      ]);

      const bounties = docs.map((d) => ({
        id: d.bounty_id,
        title: d.title,
        description: d.description,
        category: d.category,
        status: d.status,
        rewardPoints: d.reward_points,
        createdAt: d.createdAt,
        deadline: d.deadline,
        createdBy: d.creator?.id,
        creator: d.creator
          ? {
              id: d.creator.id,
              name: d.creator.name,
              avatarUrl: null,
              university: d.creator.university ? { name: d.creator.university } : null,
            }
          : null,
        _count: { bids: d.bid_count || 0, submissions: d.submission_count || 0 },
      }));

      return { bounties, total };
    } catch {
      // text index not yet built (fresh collection) or MongoDB unavailable —
      // return null so bountyService falls back to PostgreSQL
      return null;
    }
  },

  // Including university_id (the shard key) guarantees targeted routing —
  // without it the driver does a scatter-gather across every shard.
  async searchDocuments(universityId, query, page = 1, limit = 10) {
    if (!BountyCatalog) throw new Error('MongoDB not configured');

    const skip = (page - 1) * limit;
    const criteria = { university_id: universityId };
    if (query && query.trim()) {
      criteria.$text = { $search: query };
    }

    const [documents, total] = await Promise.all([
      BountyCatalog.find(criteria)
        .read('secondaryPreferred')
        .skip(skip)
        .limit(limit)
        .sort(query ? { score: { $meta: 'textScore' } } : { createdAt: -1 })
        .exec(),
      BountyCatalog.countDocuments(criteria).read('secondaryPreferred'),
    ]);

    return { documents, total };
  },

  // Used by sync worker and seeds — writes go to primary automatically
  async upsertCatalogEntry(bountyId, universityId, doc) {
    if (!BountyCatalog) return;
    return BountyCatalog.findOneAndUpdate(
      { bounty_id: bountyId, university_id: universityId },
      { $set: doc },
      { upsert: true, new: true }
    );
  },

  async removeCatalogEntry(bountyId) {
    if (!BountyCatalog) return;
    return BountyCatalog.deleteOne({ bounty_id: bountyId });
  },
};

module.exports = discoveryService;
