// ─── Bid Service ─────────────────────────────────────────────
const bidRepository = require('../repositories/bidRepository');
const bountyRepository = require('../repositories/bountyRepository');
const { cacheInvalidate } = require('../config/redis');
const AppError = require('../utils/AppError');

const bidService = {
  async placeBid(userId, bountyId, message, amount) {
    const bounty = await bountyRepository.findById(bountyId);
    if (!bounty) throw new AppError('Bounty not found', 404);
    if (bounty.status !== 'OPEN') throw new AppError('Bounty is not open for bids', 400);
    if (bounty.createdBy === userId) throw new AppError('Cannot bid on your own bounty', 400);

    const bid = await bidRepository.create({
      bountyId,
      bidderId: userId,
      message,
      amount: amount ? parseInt(amount) : null,
    });
    return bid;
  },

  async acceptBid(userId, bidId) {
    const bid = await bidRepository.findById(bidId);
    if (!bid) throw new AppError('Bid not found', 404);
    if (bid.bounty.createdBy !== userId) throw new AppError('Not authorized', 403);
    if (bid.status !== 'PENDING') throw new AppError('Bid already processed', 400);

    // Accept this bid and reject all others
    await bidRepository.updateStatus(bidId, 'ACCEPTED');
    await bidRepository.rejectOtherBids(bid.bountyId, bidId);
    await bountyRepository.update(bid.bountyId, { status: 'IN_PROGRESS' });
    await cacheInvalidate('bounties:*');

    return bidRepository.findById(bidId);
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
