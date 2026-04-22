// ─── User Controller ─────────────────────────────────────────
const userService = require('../services/userService');
const { paginate, paginatedResponse } = require('../utils/pagination');

const userController = {
  async getProfile(req, res, next) {
    try {
      const userId = parseInt(req.params.id);
      const profile = await userService.getProfile(userId);
      res.json(profile);
    } catch (err) {
      next(err);
    }
  },

  async updateProfile(req, res, next) {
    try {
      const profile = await userService.updateProfile(req.user.id, req.body);
      res.json(profile);
    } catch (err) {
      next(err);
    }
  },

  async getReputationHistory(req, res, next) {
    try {
      const userId = parseInt(req.params.id);
      const { page, limit } = paginate(req.query);
      const { logs, total } = await userService.getReputationHistory(userId, page, limit);
      res.json(paginatedResponse(logs, total, page, limit));
    } catch (err) {
      next(err);
    }
  },

  async getLeaderboard(req, res, next) {
    try {
      const limit = Math.min(50, parseInt(req.query.limit) || 20);
      const leaderboard = await userService.getLeaderboard(limit);
      res.json(leaderboard);
    } catch (err) {
      next(err);
    }
  },

  async getUniversities(req, res, next) {
    try {
      const universities = await userService.getUniversities();
      res.json(universities);
    } catch (err) {
      next(err);
    }
  },

  async getActivity(req, res, next) {
    try {
      const userId = parseInt(req.params.id);
      const { page, limit } = paginate(req.query);
      const activity = await userService.getActivity(userId, page, limit);
      res.json(activity);
    } catch (err) {
      next(err);
    }
  },
};

module.exports = userController;
