const mongoose = require('mongoose');
const { mongo } = require('./mongodb');

// MongoDB isn't required for the core platform — guard so the server still starts
// cleanly if MONGODB_URL is missing from the environment.
if (!mongo) {
  module.exports = { Document: null, BountyCatalog: null };
  return;
}

const BountyCatalogSchema = new mongoose.Schema(
  {
    bounty_id:     { type: Number, required: true, unique: true },
    university_id: { type: Number, required: true },  // shard key — include in every query
    title:         { type: String, required: true },
    description:   { type: String },
    category:      { type: String },
    status:        { type: String },
    reward_points: { type: Number },
    deadline:      { type: Date },
    creator: {
      id:         { type: Number },
      name:       { type: String },
      reputation: { type: Number },
      university: { type: String },
    },
    bid_count:        { type: Number, default: 0 },
    submission_count: { type: Number, default: 0 },
    skills:           [{ type: String }],
  },
  { timestamps: true, collection: 'bounty_catalog' }
);

// university_id is the shard key — all queries that include it get targeted routing
BountyCatalogSchema.index({ university_id: 1 });

// Compound text index powers full-text search in discoveryService
BountyCatalogSchema.index({ title: 'text', description: 'text' });

const BountyCatalog = mongo.model('BountyCatalog', BountyCatalogSchema);

// Mongoose auto-index is async — the text index may not exist yet when the first
// $text query arrives on a fresh collection. Explicitly sync after connection opens
// so the index is guaranteed present before any query can reference it.
mongo.once('open', () => {
  BountyCatalog.ensureIndexes().catch((err) =>
    console.error('[mongo] index sync error:', err.message)
  );
});

// Document alias kept for backward compatibility with discoveryService import
module.exports = { Document: BountyCatalog, BountyCatalog };
