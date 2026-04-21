// ─── Catalog Sync Worker ──────────────────────────────────────
// Consumes Redis Stream events:bounty and keeps MongoDB bounty_catalog in sync
// with PostgreSQL (source of truth). Reads from PG replica to shield primary.
const { redis } = require('../config/redis');
const { prismaRead } = require('../config/database');
const { BountyCatalog } = require('../config/Document');
const logger = require('../utils/logger');

const STREAM_KEY = 'events:bounty';
const GROUP_NAME = 'sync-workers';
const WORKER_ID = `WORKER-${process.pid}`;

function buildCatalogDoc(bounty) {
  return {
    bounty_id:     bounty.id,
    university_id: bounty.creator?.universityId,
    title:         bounty.title,
    description:   bounty.description,
    category:      bounty.category,
    status:        bounty.status,
    reward_points: bounty.rewardPoints,
    deadline:      bounty.deadline,
    creator: {
      id:         bounty.creator?.id,
      name:       bounty.creator?.name,
      reputation: bounty.creator?.reputation,
      university: bounty.creator?.university?.name,
    },
    bid_count:        bounty._count?.bids ?? 0,
    submission_count: bounty._count?.submissions ?? 0,
  };
}

async function fetchBounty(bountyId) {
  return prismaRead.bounty.findUnique({
    where: { id: bountyId },
    include: {
      creator: {
        select: { id: true, name: true, reputation: true, universityId: true, university: { select: { name: true } } },
      },
      _count: { select: { bids: true, submissions: true } },
    },
  });
}

async function processMessage(messageId, fields) {
  const type = fields.type;
  const data = JSON.parse(fields.data);

  if (type === 'BOUNTY_DELETED') {
    await BountyCatalog.deleteOne({ bounty_id: data.bountyId });
    logger.info(`[sync] removed bounty ${data.bountyId} from catalog`);
    return;
  }

  const bounty = await fetchBounty(data.bountyId);
  if (!bounty) {
    logger.warn(`[sync] bounty ${data.bountyId} not found in PG — skipping`);
    return;
  }

  if (['COMPLETED', 'CANCELLED'].includes(bounty.status)) {
    await BountyCatalog.deleteOne({ bounty_id: bounty.id });
    logger.info(`[sync] removed closed bounty ${bounty.id} from catalog (status=${bounty.status})`);
    return;
  }

  const doc = buildCatalogDoc(bounty);
  await BountyCatalog.findOneAndUpdate(
    { bounty_id: bounty.id, university_id: doc.university_id },
    { $set: doc },
    { upsert: true, new: true }
  );
  logger.info(`[sync] upserted bounty ${bounty.id} into catalog`);
}

async function fullRebuild() {
  if (!BountyCatalog) return;
  logger.info('[sync] starting full catalog rebuild from PG replica...');
  const bounties = await prismaRead.bounty.findMany({
    where: { status: 'OPEN' },
    include: {
      creator: {
        select: { id: true, name: true, reputation: true, universityId: true, university: { select: { name: true } } },
      },
      _count: { select: { bids: true, submissions: true } },
    },
  });

  for (const bounty of bounties) {
    const doc = buildCatalogDoc(bounty);
    await BountyCatalog.findOneAndUpdate(
      { bounty_id: bounty.id, university_id: doc.university_id },
      { $set: doc },
      { upsert: true, new: true }
    );
  }
  logger.info(`[sync] rebuild complete — ${bounties.length} bounties synced`);
}

async function startConsumerLoop() {
  if (!redis || !BountyCatalog) {
    logger.warn('[sync] Redis or MongoDB unavailable — sync worker disabled');
    return;
  }

  // Create consumer group if it doesn't exist (MKSTREAM creates the stream too)
  try {
    await redis.xgroup('CREATE', STREAM_KEY, GROUP_NAME, '$', 'MKSTREAM');
    logger.info(`[sync] consumer group '${GROUP_NAME}' created`);
  } catch (err) {
    if (!err.message.includes('BUSYGROUP')) throw err;
    // Group already exists — expected on restart
  }

  await fullRebuild();

  logger.info(`[sync] worker ${WORKER_ID} listening on stream '${STREAM_KEY}'`);

  while (true) {
    try {
      const results = await redis.xreadgroup(
        'GROUP', GROUP_NAME, WORKER_ID,
        'COUNT', '10',
        'BLOCK', '5000',
        'STREAMS', STREAM_KEY, '>'
      );

      if (!results) continue;

      for (const [, messages] of results) {
        for (const [messageId, rawFields] of messages) {
          // ioredis returns alternating key/value array; convert to object
          const fields = {};
          for (let i = 0; i < rawFields.length; i += 2) {
            fields[rawFields[i]] = rawFields[i + 1];
          }

          try {
            await processMessage(messageId, fields);
            await redis.xack(STREAM_KEY, GROUP_NAME, messageId);
          } catch (err) {
            logger.error(`[sync] failed to process message ${messageId}:`, err.message);
            // No XACK — Redis will redeliver on next startup
          }
        }
      }
    } catch (err) {
      logger.error('[sync] stream read error:', err.message);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
}

startConsumerLoop().catch((err) => {
  logger.error('[sync] worker crashed:', err);
  process.exit(1);
});
