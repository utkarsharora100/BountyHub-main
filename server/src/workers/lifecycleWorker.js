// ─── Lifecycle Worker ─────────────────────────────────────────
// Runs every 60 seconds. Cancels OPEN bounties past their deadline,
// rejects their pending bids, and emits events so the sync worker
// removes them from the MongoDB catalog.
const { prisma, prismaRead } = require('../config/database');
const { cacheInvalidate, publishEvent } = require('../config/redis');
const logger = require('../utils/logger');

async function expireOverdueBounties() {
  try {
    const expired = await prismaRead.bounty.findMany({
      where: {
        status: 'OPEN',
        deadline: { lt: new Date() },
      },
      include: {
        creator: { select: { universityId: true } },
      },
    });

    if (expired.length === 0) return;

    logger.info(`[lifecycle] expiring ${expired.length} overdue bounties`);

    const ids = expired.map((b) => b.id);
    await prisma.$transaction([
      prisma.bounty.updateMany({
        where: { id: { in: ids }, status: 'OPEN' },
        data: { status: 'CANCELLED' },
      }),
      prisma.bid.updateMany({
        where: { bountyId: { in: ids }, status: 'PENDING' },
        data: { status: 'REJECTED' },
      }),
    ]);

    await Promise.allSettled(
      expired.map((bounty) =>
        publishEvent('BOUNTY_UPDATED', {
          bountyId: bounty.id,
          universityId: bounty.creator?.universityId,
        })
      )
    );

    await cacheInvalidate('bounties:*');
    await cacheInvalidate('trending:*');
    logger.info(`[lifecycle] cancelled ${expired.length} overdue bounties`);
  } catch (err) {
    logger.error('[lifecycle] expiry run failed:', err.message);
  }
}

// Run immediately on startup, then every 60 seconds
expireOverdueBounties();
setInterval(expireOverdueBounties, 60_000);

logger.info('[lifecycle] worker started — checking for expired bounties every 60s');
