// ─── Search Controller ───────────────────────────────────────
const searchService = require('../services/searchService');

const searchController = {
  async suggestions(req, res, next) {
    try {
      const prefix = req.query.q || '';
      const suggestions = await searchService.getSuggestions(prefix);
      res.json(suggestions);
    } catch (err) {
      next(err);
    }
  },

  async matches(req, res, next) {
    try {
      const prefix = req.query.q || '';
      const limit = req.query.limit || 6;
      const matches = await searchService.getMatches(prefix, limit);
      res.json(matches);
    } catch (err) {
      next(err);
    }
  },

  async unmetDemand(req, res, next) {
    try {
      const limit = req.query.limit || 25;
      const demand = await searchService.getUnmetDemand(limit);
      res.json(demand);
    } catch (err) {
      next(err);
    }
  },
};

module.exports = searchController;
