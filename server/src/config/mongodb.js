const { MongoClient } = require('mongodb');
const config = require('./index');
const logger = require('../utils/logger');

let client;
let db;
let unavailable = false;
let lastFailureAt = 0;

async function getMongoDb() {
  if (!config.mongo.url) return null;
  if (unavailable && Date.now() - lastFailureAt < 10000) return null;
  unavailable = false;
  if (db) return db;

  try {
    client = new MongoClient(config.mongo.url, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 2000,
    });
    await client.connect();
    db = client.db(config.mongo.dbName);
    logger.info(`MongoDB catalog connected (${config.mongo.dbName})`);
    return db;
  } catch (err) {
    unavailable = true;
    lastFailureAt = Date.now();
    logger.warn(`MongoDB catalog unavailable: ${err.message}`);
    return null;
  }
}

async function closeMongo() {
  if (!client) return;
  await client.close();
  client = null;
  db = null;
}

module.exports = {
  getMongoDb,
  closeMongo,
};
