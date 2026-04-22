// ─── User Service ────────────────────────────────────────────
const userRepository = require('../repositories/userRepository');
const bountyRepository = require('../repositories/bountyRepository');
const bidRepository = require('../repositories/bidRepository');
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
    if (data.name) allowed.name = data.name;
    if (data.avatarUrl) allowed.avatarUrl = data.avatarUrl;

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

  // Cache universities for 10 minutes — they basically never change after seed.
  async getUniversities() {
    return cacheGet('universities:all', () => userRepository.getAllUniversities(), 600);
  },

  async getActivity(userId, page, limit) {
    const skip = (page - 1) * limit;
    const [createdResult, bidsResult] = await Promise.all([
      bountyRepository.findByCreator(userId, skip, limit),
      bidRepository.findByBidder(userId, skip, limit),
    ]);
    return {
      created: createdResult.bounties,
      createdTotal: createdResult.total,
      bids: bidsResult.bids,
      bidsTotal: bidsResult.total,
      total: createdResult.total + bidsResult.total,
    };
  },
};

module.exports = userService;
