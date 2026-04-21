// ─── Bounty Controller ───────────────────────────────────────
const bountyService = require('../services/bountyService');
const { paginate, paginatedResponse } = require('../utils/pagination');
const { prismaRead } = require('../config/database');
// Pull enum values straight from the Prisma client — they're always in sync with schema.prisma.
const { BountyStatus, Category, BountyCategory } = require('@prisma/client');

const bountyController = {
  async create(req, res, next) {
    try {
      const user = await prismaRead.user.findUnique({ where: { id: req.user.id } });
      if (!user || user.role !== 'STAFF') {
        return res.status(403).json({ error: 'Only university staff can create tasks' });
      }

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

      const searchService = require('../services/searchService');
      searchService.addSearchSuggestion(q).catch(() => {});

      // Track zero-result searches as unmet demand signals
      if (result.total === 0) {
        searchService.trackUnmetDemand(q).catch(() => {});
      }

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

  // Returns the valid filter/sort options for the bounty list.
  // Reads categories and statuses from the Prisma enum objects so this endpoint
  // stays accurate automatically whenever the schema changes and prisma generate runs.
  async meta(_req, res, next) {
    try {
      // Safely read the enum regardless of what it was named in schema.prisma
      const CategoryEnum = Category || BountyCategory || { CODING: 'CODING', RESEARCH: 'RESEARCH', DESIGN: 'DESIGN', DEBUGGING: 'DEBUGGING', DOCUMENTATION: 'DOCUMENTATION', OTHER: 'OTHER' };
      res.json({
        categories: Object.values(CategoryEnum).map(c => ({ id: c, name: c })),
        statuses: Object.values(BountyStatus),
        // These mirror the switch in bountyService.list — if you add a sort, add it here too.
        sortOptions: [
          { value: 'newest', label: 'Newest' },
          { value: 'oldest', label: 'Oldest' },
          { value: 'reward', label: 'Highest Reward' },
          { value: 'deadline', label: 'Deadline' },
        ],
      });
    } catch (err) {
      next(err);
    }
  },
};

module.exports = bountyController;
