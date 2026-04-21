const config = require('./index');

// Guard BEFORE requiring mongoose. If MONGODB_URL isn't set (e.g. local dev without Docker)
// and mongoose isn't installed yet, putting require('mongoose') at the top would throw
// "Cannot find module 'mongoose'" before this check could do anything about it.
if (!config.mongodb.url) {
  console.warn('MONGODB_URL not set — MongoDB/discovery features disabled');
  module.exports = { mongo: null, mongoRead: null };
  return;
}

const mongoose = require('mongoose');

// ONE connection for the entire replica set.
//
// The old pattern (two separate connections to the same replica set URI) caused
// two independent topology monitors to probe the same nodes simultaneously — that's
// the connection churn visible in the logs (pairs of connect/disconnect events).
//
// With a single connection the driver runs one topology monitor and routes internally:
//   writes  → primary  (replicas reject writes, driver knows this)
//   reads   → secondary (per readPreference=secondaryPreferred in the URI)
const conn = mongoose.createConnection(config.mongodb.url, {
  serverSelectionTimeoutMS: 5000,
  heartbeatFrequencyMS: 10000,  // default is 10s anyway, but explicit is clearer
});

conn.on('connected', () => console.log('MongoDB replica set connected'));
conn.on('error', (err) => console.error('MongoDB error:', err.message));
conn.on('disconnected', () => console.warn('MongoDB disconnected — driver will retry'));

// Both names point to the same connection object.
// Document.js uses both exports; merging them avoids the OverwriteModelError that
// would occur from registering the same Mongoose model twice on the same connection.
module.exports = { mongo: conn, mongoRead: conn };
