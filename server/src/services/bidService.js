// ─── Bid Service ─────────────────────────────────────────────
const { prisma, prismaRead } = require('../config/database');
const { Prisma } = require('@prisma/client');
const { cacheInvalidate, publishEvent } = require('../config/redis');
const AppError = require('../utils/AppError');

function validateBountyForBid(bounty, userId) {
  if (!bounty) throw new AppError('Bounty not found', 404);
  if (bounty.status !== 'OPEN') throw new AppError('Bounty is not open for bids', 400);
  if (bounty.deadline && new Date(bounty.deadline) <= new Date()) {
    throw new AppError('Bounty deadline has passed', 400);
  }
  if (bounty.createdBy === userId) throw new AppError('Cannot bid on your own bounty', 400);
}

function normalizeBidAmount(amount, bountyReward) {
  if (amount === undefined || amount === null || amount === '') return null;
  const parsed = parseInt(amount, 10);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new AppError('Bid amount must be a positive integer', 400);
  }
  if (parsed > bountyReward) {
    throw new AppError('Bid amount cannot exceed the bounty reward', 400);
  }
  return parsed;
}

const bidService = {
  async placeBid(userId, bountyId, message, amount) {
    const bounty = await prismaRead.bounty.findUnique({ where: { id: bountyId } });
    if (!bounty) throw new AppError('Bounty not found', 404);
    if (bounty.status !== 'OPEN') throw new AppError('Bounty is not open for bids', 400);
    if (bounty.createdBy === userId) throw new AppError('Cannot bid on your own bounty', 400);

    return prisma.bid.create({
      data: { bountyId, bidderId: userId, message, amount: amount ? parseInt(amount) : null },
    });
  },

  async acceptBid(userId, bidId) {
    // Pre-flight read (replica) — cheap check before acquiring locks
    const bidCheck = await prismaRead.bid.findUnique({
      where: { id: bidId },
      include: {
        bounty: { include: { creator: { select: { universityId: true } } } },
      },
    });
    if (!bidCheck) throw new AppError('Bid not found', 404);
    if (bidCheck.bounty.createdBy !== userId) throw new AppError('Not authorized', 403);
    if (bidCheck.status !== 'PENDING') throw new AppError('Bid already processed', 400);
    if (bidCheck.bounty.status !== 'OPEN') throw new AppError('Bounty is not open', 400);

    // Serializable transaction prevents two concurrent acceptBid calls from both succeeding
    const accepted = await prisma.$transaction(async (tx) => {
      const bid = await tx.bid.findUnique({ where: { id: bidId } });
      if (!bid || bid.status !== 'PENDING') throw new AppError('Bid already processed', 400);

      const updated = await tx.bid.update({ where: { id: bidId }, data: { status: 'ACCEPTED' } });
      await tx.bid.updateMany({
        where: { bountyId: bid.bountyId, id: { not: bidId }, status: 'PENDING' },
        data: { status: 'REJECTED' },
      });
      await tx.bounty.update({ where: { id: bid.bountyId }, data: { status: 'IN_PROGRESS' } });
      return updated;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    await cacheInvalidate('bounties:*');
    await publishEvent('BID_ACCEPTED', {
      bountyId: bidCheck.bountyId,
      bidId,
      bidderId: bidCheck.bidderId,
      universityId: bidCheck.bounty.creator?.universityId,
    });

    return accepted;
  },

  async rejectBid(userId, bidId) {
    const bid = await prismaRead.bid.findUnique({
      where: { id: bidId },
      include: { bounty: true },
    });
    if (!bid) throw new AppError('Bid not found', 404);
    if (bid.bounty.createdBy !== userId) throw new AppError('Not authorized', 403);

    return prisma.bid.update({ where: { id: bidId }, data: { status: 'REJECTED' } });
  },

  async getBidsForBounty(bountyId, page, limit) {
    const skip = (page - 1) * limit;
    const [bids, total] = await Promise.all([
      prismaRead.bid.findMany({
        where: { bountyId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          bidder: {
            select: { id: true, name: true, avatarUrl: true, reputation: true, university: { select: { name: true } } },
          },
        },
      }),
      prismaRead.bid.count({ where: { bountyId } }),
    ]);
    return { bids, total };
  },
};

module.exports = bidService;
