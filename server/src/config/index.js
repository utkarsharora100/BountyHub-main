require('dotenv').config();
const os = require('os');

module.exports = {
  port: process.env.PORT || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:3000',

  db: {
    url: process.env.DATABASE_URL,
    readUrl: process.env.DATABASE_READ_URL || process.env.DATABASE_URL,
  },

  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },

  mongo: {
    url: process.env.MONGODB_URL || '',
    dbName: process.env.MONGODB_DB || 'bounty_catalog',
    catalogCollection: process.env.MONGODB_CATALOG_COLLECTION || 'bounty_catalog',
  },

  events: {
    bountyStream: process.env.BOUNTY_EVENT_STREAM || 'events:bounty',
    catalogGroup: process.env.CATALOG_SYNC_GROUP || 'catalog-sync',
    catalogConsumer: process.env.CATALOG_SYNC_CONSUMER || `${os.hostname()}-${process.pid}`,
    catalogBatchSize: parseInt(process.env.CATALOG_SYNC_BATCH_SIZE || '25', 10),
    catalogBlockMs: parseInt(process.env.CATALOG_SYNC_BLOCK_MS || '5000', 10),
  },

  readModels: {
    rebuildOnApiStart: process.env.READ_MODEL_REBUILD_ON_START !== 'false',
    embeddedSyncWorker: process.env.ENABLE_EMBEDDED_SYNC_WORKER !== 'false',
  },

  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
};
