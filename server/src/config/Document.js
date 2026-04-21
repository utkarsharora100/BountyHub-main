const mongoose = require('mongoose');
const { mongo } = require('./mongodb');

// MongoDB isn't required for the core platform — guard so the server still starts
// cleanly if MONGODB_URL is missing from the environment.
if (!mongo) {
  module.exports = { Document: null, DocumentRead: null };
  return;
}

const DocumentSchema = new mongoose.Schema({
  title:         { type: String, required: true },
  content:       { type: String, required: true },
  university_id: { type: Number, required: true },
  bounty_id:     { type: Number },
  author_id:     { type: Number, required: true },
  tags:          [{ type: String }],
  metadata:      { type: mongoose.Schema.Types.Mixed },
}, { timestamps: true });

// university_id is the shard key — all queries that include it get targeted routing
// instead of a scatter-gather across every shard.
DocumentSchema.set('shardKey', { university_id: 1 });
DocumentSchema.index({ university_id: 1 });

// Compound text index powers the full-text search in discoveryService.
DocumentSchema.index({ title: 'text', content: 'text', tags: 'text' });

// Single model on the single connection.
// discoveryService passes { readPreference: 'secondaryPreferred' } per query for reads,
// and creates go to the primary automatically (replicas reject writes in a replica set).
const Document = mongo.model('Document', DocumentSchema);

// Export DocumentRead as an alias so discoveryService doesn't need to change its imports.
module.exports = { Document, DocumentRead: Document };
