// ─── Bounty Controller ───────────────────────────────────────
const bountyService = require('../services/bountyService');
const { paginate, paginatedResponse } = require('../utils/pagination');

const bountyController = {
  async create(req, res, next) {
    try {
      const bounty = await bountyService.create(req.user.id, req.body);
      res.status(201).json(bounty);
    } catch (err) {
      next(err);
    }
  },

  async update(req, res, next) {
    try {
      const bountyId = parseInt(req.params.id);
      const bounty = await bountyService.update(req.user.id, bountyId, req.body);
      res.json(bounty);
    } catch (err) {
      next(err);
    }
  },

  async delete(req, res, next) {
    try {
      const bountyId = parseInt(req.params.id);
      await bountyService.delete(req.user.id, bountyId);
      res.json({ message: 'Bounty deleted' });
    } catch (err) {
      next(err);
    }
  },

  async getById(req, res, next) {
    try {
      const bountyId = parseInt(req.params.id);
      const bounty = await bountyService.getById(bountyId);
      res.json(bounty);
    } catch (err) {
      next(err);
    }
  },

  async list(req, res, next) {
    try {
      const { page, limit } = paginate(req.query);
      const result = await bountyService.list({ ...req.query, page, limit });
      res.json(paginatedResponse(result.bounties, result.total, page, limit));
    } catch (err) {
      next(err);
    }
  },

  async search(req, res, next) {
    try {
      const { page, limit } = paginate(req.query);
      const q = req.query.q;
      const result = await bountyService.search(q, page, limit);

      // Track search term for autocomplete
      const searchService = require('../services/searchService');
      searchService.addSearchSuggestion(q).catch(() => {});

      res.json(paginatedResponse(result.bounties, result.total, page, limit));
    } catch (err) {
      next(err);
    }
  },

  async trending(req, res, next) {
    try {
      const bounties = await bountyService.getTrending();
      res.json(bounties);
    } catch (err) {
      next(err);
    }
  },
};

module.exports = bountyController;
