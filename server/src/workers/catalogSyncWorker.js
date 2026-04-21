const logger = require('../utils/logger');
const { rebuildReadModels, startCatalogSyncWorker } = require('../services/catalogSyncService');
const { closeMongo } = require('../config/mongodb');

let worker;

async function main() {
  const { searchIndexed, catalogEnabled, catalogIndexed } = await rebuildReadModels();
  logger.info(`Catalog worker rebuilt read models (redis=${searchIndexed}, mongo=${catalogEnabled ? catalogIndexed : 'disabled'})`);
  worker = startCatalogSyncWorker();
}

async function shutdown() {
  if (worker) worker.stop();
  await closeMongo();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

main().catch((err) => {
  logger.error(err);
  process.exit(1);
});
