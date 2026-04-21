// ─── User Service ────────────────────────────────────────────
const userRepository = require('../repositories/userRepository');
const { cacheGet, cacheInvalidate } = require('../config/redis');
const AppError = require('../utils/AppError');

const userService = {
  async getProfile(userId) {
    const user = await userRepository.findById(userId);
    if (!user) throw new AppError('User not found', 404);
    const { passwordHash, ...profile } = user;
    return profile;
  },

  async updateProfile(userId, data) {
    const allowed = {};
    if (data.name && data.name.trim()) allowed.name = data.name.trim();
    if (Object.prototype.hasOwnProperty.call(data, 'avatarUrl')) {
      allowed.avatarUrl = data.avatarUrl ? data.avatarUrl.trim() : null;
    }
    if (Object.keys(allowed).length === 0) throw new AppError('No profile fields provided', 400);

    const user = await userRepository.update(userId, allowed);
    await cacheInvalidate('leaderboard:*');
    const { passwordHash, ...profile } = user;
    return profile;
  },

  async getReputationHistory(userId, page, limit) {
    return userRepository.getReputationHistory(userId, (page - 1) * limit, limit);
  },

  async getLeaderboard(limit = 20) {
    return cacheGet(`leaderboard:top${limit}`, () => userRepository.getLeaderboard(limit), 60);
  },
};

module.exports = userService;
