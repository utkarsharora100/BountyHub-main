const { Prisma } = require('@prisma/client');
const bidRepository = require('../repositories/bidRepository');
const { prisma } = require('../config/database');
const { cacheInvalidate } = require('../config/redis');
const searchService = require('./searchService');
const AppError = require('../utils/AppError');

function validateBountyForBid(bounty, userId) {
  if (!bounty) throw new AppError('Bounty not found', 404);
  if (bounty.status !== 'OPEN') throw new AppError('Bounty is not open for bids', 400);
  if (bounty.deadline && new Date(bounty.deadline) <= new Date()) {
    throw new AppError('Bounty deadline has passed', 400);
  }
  if (bounty.createdBy === userId) throw new AppError('Cannot bid on your own bounty', 400);
}

const bidService = {
  async placeBid(userId, bountyId, message, amount) {
    return prisma.$transaction(async (tx) => {
      const bounty = await tx.bounty.findUnique({ where: { id: bountyId } });
      validateBountyForBid(bounty, userId);

      return tx.bid.create({
        data: {
          bountyId,
          bidderId: userId,
          message,
          amount: amount ? parseInt(amount, 10) : null,
        },
      });
    });
  },

  async acceptBid(userId, bidId) {
    let accepted;
    try {
      accepted = await prisma.$transaction(async (tx) => {
        const bid = await tx.bid.findUnique({
          where: { id: bidId },
          include: { bidder: { select: { id: true, name: true } }, bounty: true },
        });

        if (!bid) throw new AppError('Bid not found', 404);
        if (bid.bounty.createdBy !== userId) throw new AppError('Not authorized', 403);
        if (bid.status !== 'PENDING') throw new AppError('Bid already processed', 400);
        if (bid.bounty.status !== 'OPEN') throw new AppError('Bounty is not open for bid acceptance', 409);
        if (bid.bounty.deadline && new Date(bid.bounty.deadline) <= new Date()) {
          throw new AppError('Bounty deadline has passed', 400);
        }

        const claimedBounty = await tx.bounty.updateMany({
          where: { id: bid.bountyId, status: 'OPEN' },
          data: { status: 'IN_PROGRESS' },
        });
        if (claimedBounty.count !== 1) {
          throw new AppError('Another bid was accepted first', 409);
        }

        const claimedBid = await tx.bid.updateMany({
          where: { id: bidId, status: 'PENDING' },
          data: { status: 'ACCEPTED' },
        });
        if (claimedBid.count !== 1) {
          throw new AppError('Bid already processed', 409);
        }

        await tx.bid.updateMany({
          where: { bountyId: bid.bountyId, id: { not: bidId }, status: 'PENDING' },
          data: { status: 'REJECTED' },
        });

        return tx.bid.findUnique({
          where: { id: bidId },
          include: { bidder: { select: { id: true, name: true } }, bounty: true },
        });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (err) {
      if (err.code === 'P2034') throw new AppError('Concurrent bid update detected, please retry', 409);
      throw err;
    }

    await cacheInvalidate('bounties:*');
    await cacheInvalidate('trending:*');
    await searchService.removeBountyFromIndex(accepted.bountyId);
    return accepted;
  },

  async rejectBid(userId, bidId) {
    const bid = await bidRepository.findById(bidId);
    if (!bid) throw new AppError('Bid not found', 404);
    if (bid.bounty.createdBy !== userId) throw new AppError('Not authorized', 403);

    return bidRepository.updateStatus(bidId, 'REJECTED');
  },

  async getBidsForBounty(bountyId, page, limit) {
    return bidRepository.findByBounty(bountyId, (page - 1) * limit, limit);
  },
};

module.exports = bidService;
