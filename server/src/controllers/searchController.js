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

  async unmetDemand(req, res, next) {
    try {
      const limit = Math.min(parseInt(req.query.limit) || 20, 100);
      const terms = await searchService.getUnmetDemand(limit);
      res.json(terms);
    } catch (err) {
      next(err);
    }
  },
};

module.exports = searchController;
