const config = require('../config');
const { redis } = require('../config/redis');
const logger = require('../utils/logger');
const bountyRepository = require('../repositories/bountyRepository');
const catalogRepository = require('../repositories/catalogRepository');
const searchService = require('./searchService');

function parseFields(fields) {
  const event = {};
  for (let i = 0; i < fields.length; i += 2) {
    event[fields[i]] = fields[i + 1];
  }
  if (event.payload) {
    try {
      event.payload = JSON.parse(event.payload);
    } catch {
      event.payload = {};
    }
  }
  return event;
}

function shouldIndex(bounty) {
  return bounty
    && bounty.status === 'OPEN'
    && (!bounty.deadline || new Date(bounty.deadline) > new Date());
}

async function syncBountyReadModels(bountyId) {
  const bounty = await bountyRepository.findByIdForIndex(bountyId);
  if (!shouldIndex(bounty)) {
    await Promise.all([
      searchService.removeBountyFromIndex(bountyId),
      catalogRepository.removeBounty(bountyId),
    ]);
    return { indexed: false };
  }

  await Promise.all([
    searchService.indexBounty(bounty),
    catalogRepository.upsertBounty(bounty),
  ]);
  return { indexed: true };
}

async function processEvent(event) {
  const bountyId = parseInt(event.bountyId, 10);
  if (!Number.isInteger(bountyId)) return;

  if (event.type === 'bounty.deleted') {
    await Promise.all([
      searchService.removeBountyFromIndex(bountyId),
      catalogRepository.removeBounty(bountyId),
    ]);
    return;
  }

  await syncBountyReadModels(bountyId);
}

async function ensureGroup() {
  if (!redis) return false;
  try {
    await redis.xgroup('CREATE', config.events.bountyStream, config.events.catalogGroup, '$', 'MKSTREAM');
    return true;
  } catch (err) {
    if (String(err.message || '').includes('BUSYGROUP')) return true;
    logger.warn(`Catalog sync group unavailable: ${err.message}`);
    return false;
  }
}

async function pollOnce() {
  const response = await redis.xreadgroup(
    'GROUP',
    config.events.catalogGroup,
    config.events.catalogConsumer,
    'COUNT',
    config.events.catalogBatchSize,
    'BLOCK',
    config.events.catalogBlockMs,
    'STREAMS',
    config.events.bountyStream,
    '>'
  );

  if (!response) return 0;

  let processed = 0;
  for (const [, messages] of response) {
    for (const [id, fields] of messages) {
      try {
        await processEvent(parseFields(fields));
        await redis.xack(config.events.bountyStream, config.events.catalogGroup, id);
        processed += 1;
      } catch (err) {
        logger.error(`Catalog sync failed for event ${id}: ${err.message}`);
      }
    }
  }
  return processed;
}

async function rebuildReadModels() {
  const bounties = await bountyRepository.findIndexableForSearch();
  const [searchResult, catalogResult] = await Promise.all([
    searchService.rebuildBountyIndex(bounties),
    catalogRepository.rebuild(bounties),
  ]);

  return {
    searchIndexed: searchResult.indexed,
    catalogEnabled: catalogResult.enabled,
    catalogIndexed: catalogResult.count,
  };
}

function startCatalogSyncWorker() {
  if (!redis) {
    logger.warn('Catalog sync worker disabled: Redis unavailable');
    return null;
  }

  let stopped = false;

  async function loop() {
    const ready = await ensureGroup();
    if (!ready) return;

    logger.info('Catalog sync worker started');
    while (!stopped) {
      try {
        await pollOnce();
      } catch (err) {
        logger.warn(`Catalog sync poll failed: ${err.message}`);
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
  }

  loop().catch((err) => logger.error(err));

  return {
    stop() {
      stopped = true;
    },
  };
}

module.exports = {
  rebuildReadModels,
  startCatalogSyncWorker,
  syncBountyReadModels,
};
