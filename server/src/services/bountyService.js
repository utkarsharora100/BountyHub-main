// ─── Bounty Service ──────────────────────────────────────────
const bountyRepository = require('../repositories/bountyRepository');
const { cacheGet, cacheInvalidate } = require('../config/redis');
const AppError = require('../utils/AppError');

const bountyService = {
  async create(userId, data) {
    const bounty = await bountyRepository.create({
      title: data.title,
      description: data.description,
      rewardPoints: parseInt(data.rewardPoints),
      category: data.category || 'OTHER',
      deadline: data.deadline ? new Date(data.deadline) : null,
      createdBy: userId,
    });
    await cacheInvalidate('bounties:*');
    await cacheInvalidate('trending:*');
    return bounty;
  },

  async update(userId, bountyId, data) {
    const bounty = await bountyRepository.findById(bountyId);
    if (!bounty) throw new AppError('Bounty not found', 404);
    if (bounty.createdBy !== userId) throw new AppError('Not authorized', 403);

    const updated = await bountyRepository.update(bountyId, {
      ...(data.title && { title: data.title }),
      ...(data.description && { description: data.description }),
      ...(data.rewardPoints && { rewardPoints: parseInt(data.rewardPoints) }),
      ...(data.category && { category: data.category }),
      ...(data.status && { status: data.status }),
      ...(data.deadline && { deadline: new Date(data.deadline) }),
    });
    await cacheInvalidate('bounties:*');
    await cacheInvalidate('trending:*');
    return updated;
  },

  async delete(userId, bountyId) {
    const bounty = await bountyRepository.findById(bountyId);
    if (!bounty) throw new AppError('Bounty not found', 404);
    if (bounty.createdBy !== userId) throw new AppError('Not authorized', 403);

    await bountyRepository.delete(bountyId);
    await cacheInvalidate('bounties:*');
    await cacheInvalidate('trending:*');
  },

  async getById(bountyId) {
    const bounty = await bountyRepository.findById(bountyId);
    if (!bounty) throw new AppError('Bounty not found', 404);
    return bounty;
  },

  async list(query) {
    const { page = 1, limit = 10, status, category, sortBy } = query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    const where = {};
    if (status) where.status = status;
    if (category) where.category = category;

    let orderBy;
    switch (sortBy) {
      case 'reward': orderBy = { rewardPoints: 'desc' }; break;
      case 'oldest': orderBy = { createdAt: 'asc' }; break;
      case 'deadline': orderBy = { deadline: 'asc' }; break;
      default: orderBy = { createdAt: 'desc' };
    }

    const cacheKey = `bounties:list:${JSON.stringify({ skip, take, where, sortBy })}`;
    return cacheGet(cacheKey, () => bountyRepository.findMany({ skip, take, where, orderBy }), 30);
  },

  async search(query, page = 1, limit = 10) {
    if (!query || query.trim().length < 2) throw new AppError('Search query too short', 400);
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const cacheKey = `bounties:search:${query}:${page}:${limit}`;
    return cacheGet(cacheKey, () => bountyRepository.search(query, skip, parseInt(limit)), 60);
  },

  async getTrending() {
    return cacheGet('trending:bounties', () => bountyRepository.getTrending(10), 60);
  },
};

module.exports = bountyService;
