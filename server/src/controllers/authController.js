// ─── Auth Controller ─────────────────────────────────────────
const authService = require('../services/authService');

const authController = {
  async register(req, res, next) {
    try {
      const result = await authService.register(req.body);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  },

  async login(req, res, next) {
    try {
      const result = await authService.login(req.body);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },

  async logout(_req, res) {
    // JWT is stateless; client discards the token
    res.json({ message: 'Logged out successfully' });
  },

  async me(req, res, next) {
    try {
      const userService = require('../services/userService');
      const profile = await userService.getProfile(req.user.id);
      res.json(profile);
    } catch (err) {
      next(err);
    }
  },
};

module.exports = authController;
