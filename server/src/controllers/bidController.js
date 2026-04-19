// ─── Bid Controller ──────────────────────────────────────────
const bidService = require('../services/bidService');
const { paginate, paginatedResponse } = require('../utils/pagination');

const bidController = {
  async placeBid(req, res, next) {
    try {
      const bountyId = parseInt(req.params.bountyId);
      const { message, amount } = req.body;
      const bid = await bidService.placeBid(req.user.id, bountyId, message, amount);
      res.status(201).json(bid);
    } catch (err) {
      next(err);
    }
  },

  async acceptBid(req, res, next) {
    try {
      const bidId = parseInt(req.params.id);
      const bid = await bidService.acceptBid(req.user.id, bidId);
      res.json(bid);
    } catch (err) {
      next(err);
    }
  },

  async rejectBid(req, res, next) {
    try {
      const bidId = parseInt(req.params.id);
      const bid = await bidService.rejectBid(req.user.id, bidId);
      res.json(bid);
    } catch (err) {
      next(err);
    }
  },

  async getBidsForBounty(req, res, next) {
    try {
      const bountyId = parseInt(req.params.bountyId);
      const { page, limit } = paginate(req.query);
      const { bids, total } = await bidService.getBidsForBounty(bountyId, page, limit);
      res.json(paginatedResponse(bids, total, page, limit));
    } catch (err) {
      next(err);
    }
  },
};

module.exports = bidController;
