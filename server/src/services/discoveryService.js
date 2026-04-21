const { BountyCatalog } = require('../config/Document');

const discoveryService = {
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
