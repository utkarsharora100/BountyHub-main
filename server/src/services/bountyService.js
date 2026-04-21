// ─── Bounty Service ──────────────────────────────────────────
const bountyRepository = require('../repositories/bountyRepository');
const { cacheGet, cacheInvalidate } = require('../config/redis');
const AppError = require('../utils/AppError');
const searchService = require('./searchService');

function assertFutureDeadline(deadline) {
  if (!deadline) return null;
  const parsed = new Date(deadline);
  if (Number.isNaN(parsed.getTime())) throw new AppError('Invalid deadline', 400);
  if (parsed <= new Date()) throw new AppError('Deadline must be in the future', 400);
  return parsed;
}

function normalizeSkills(skills) {
  if (!skills) return [];
  const values = Array.isArray(skills) ? skills : String(skills).split(',');
  return [...new Set(values.map((skill) => String(skill).trim()).filter(Boolean))].slice(0, 20);
}

async function refreshSearchIndex(bountyId) {
  const bounty = await bountyRepository.findByIdForIndex(bountyId);
  if (bounty) {
    await searchService.indexBounty(bounty);
  } else {
    await searchService.removeBountyFromIndex(bountyId);
  }
}

const bountyService = {
  async create(userId, data) {
    const deadline = assertFutureDeadline(data.deadline);
    const bounty = await bountyRepository.create({
      title: data.title,
      description: data.description,
      rewardPoints: parseInt(data.rewardPoints),
      category: data.category || 'OTHER',
      department: data.department || null,
      skills: normalizeSkills(data.skills),
      deadline,
      createdBy: userId,
    });
    await cacheInvalidate('bounties:*');
    await cacheInvalidate('trending:*');
    await refreshSearchIndex(bounty.id);
    return bounty;
  },

  async update(userId, bountyId, data) {
    const bounty = await bountyRepository.findById(bountyId);
    if (!bounty) throw new AppError('Bounty not found', 404);
    if (bounty.createdBy !== userId) throw new AppError('Not authorized', 403);

    const deadline = data.deadline ? assertFutureDeadline(data.deadline) : null;
    const updated = await bountyRepository.update(bountyId, {
      ...(data.title && { title: data.title }),
      ...(data.description && { description: data.description }),
      ...(data.rewardPoints && { rewardPoints: parseInt(data.rewardPoints) }),
      ...(data.category && { category: data.category }),
      ...(Object.prototype.hasOwnProperty.call(data, 'department') && { department: data.department || null }),
      ...(Object.prototype.hasOwnProperty.call(data, 'skills') && { skills: normalizeSkills(data.skills) }),
      ...(data.status && { status: data.status }),
      ...(data.deadline && { deadline }),
    });
    await cacheInvalidate('bounties:*');
    await cacheInvalidate('trending:*');
    await refreshSearchIndex(bountyId);
    return updated;
  },

  async delete(userId, bountyId) {
    const bounty = await bountyRepository.findById(bountyId);
    if (!bounty) throw new AppError('Bounty not found', 404);
    if (bounty.createdBy !== userId) throw new AppError('Not authorized', 403);

    await bountyRepository.delete(bountyId);
    await cacheInvalidate('bounties:*');
    await cacheInvalidate('trending:*');
    await searchService.removeBountyFromIndex(bountyId);
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
    const result = await cacheGet(cacheKey, async () => (
      await searchService.searchBounties(query, page, limit)
      || bountyRepository.search(query, skip, parseInt(limit))
    ), 60);

    if (result.total === 0) {
      searchService.logUnmetDemand(query).catch(() => {});
    }
    return result;
  },

  async getTrending() {
    return cacheGet('trending:bounties', () => bountyRepository.getTrending(10), 60);
  },
};

module.exports = bountyService;
