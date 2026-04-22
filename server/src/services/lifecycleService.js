const bountyRepository = require('../repositories/bountyRepository');
const { cacheInvalidate } = require('../config/redis');
const { publishBountyEvent } = require('./eventBus');
const logger = require('../utils/logger');

const ONE_MINUTE = 60 * 1000;

async function expireDueBounties() {
  const result = await bountyRepository.expireOpenBefore(new Date());
  if (result.count === 0) return result;

  await Promise.all([
    cacheInvalidate('bounties:*'),
    cacheInvalidate('trending:*'),
    ...result.ids.map((id) => publishBountyEvent('bounty.closed', id, { reason: 'deadline.expired' })),
  ]);

  logger.info(`Expired ${result.count} overdue bounties`);
  return result;
}

function startLifecycleWorker(intervalMs = ONE_MINUTE) {
  expireDueBounties().catch((err) => logger.error(err));
  const timer = setInterval(() => {
    expireDueBounties().catch((err) => logger.error(err));
  }, intervalMs);

  if (typeof timer.unref === 'function') timer.unref();
  return timer;
}

module.exports = {
  expireDueBounties,
  startLifecycleWorker,
};
