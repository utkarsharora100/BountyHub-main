const { Document } = require('../config/Document');

const discoveryService = {
  // Including university_id (the shard key) guarantees targeted routing —
  // without it the driver does a scatter-gather across every shard.
  async searchDocuments(universityId, query, page = 1, limit = 10) {
    if (!Document) throw new Error('MongoDB not configured');

    const skip = (page - 1) * limit;
    const criteria = { university_id: universityId };
    if (query && query.trim()) {
      criteria.$text = { $search: query };
    }

    // Both connections are the same object now, so we set readPreference per-query
    // rather than relying on a separate "read" connection.
    const [documents, total] = await Promise.all([
      Document.find(criteria)
        .read('secondaryPreferred')
        .skip(skip)
        .limit(limit)
        .sort(query ? { score: { $meta: 'textScore' } } : { createdAt: -1 })
        .exec(),
      Document.countDocuments(criteria).read('secondaryPreferred'),
    ]);

    return { documents, total };
  },

  // Writes go to the primary automatically — no special config needed.
  async addDocument(data) {
    if (!Document) throw new Error('MongoDB not configured');
    return Document.create(data);
  },
};

module.exports = discoveryService;
