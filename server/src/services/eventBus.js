const config = require('../config');
const { redis } = require('../config/redis');
const logger = require('../utils/logger');

async function publishBountyEvent(type, bountyId, payload = {}) {
  if (!redis || !bountyId) return false;

  try {
    await redis.xadd(
      config.events.bountyStream,
      'MAXLEN',
      '~',
      '10000',
      '*',
      'type',
      type,
      'bountyId',
      String(bountyId),
      'payload',
      JSON.stringify(payload)
    );
    return true;
  } catch (err) {
    logger.warn(`Bounty event publish failed: ${err.message}`);
    return false;
  }
}

module.exports = {
  publishBountyEvent,
};
