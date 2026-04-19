// ─── Bounty Repository (Data Access Layer) ──────────────────
const { prisma, prismaRead } = require('../config/database');

const bountyRepository = {
  // ── WRITE (master) ──────────────────────────────────────────
  async create(data) {
    return prisma.bounty.create({ data });
  },

  async update(id, data) {
    return prisma.bounty.update({ where: { id }, data });
  },

  async delete(id) {
    return prisma.bounty.delete({ where: { id } });
  },

  // ── READ (replica) ─────────────────────────────────────────
  async findById(id) {
    return prismaRead.bounty.findUnique({
      where: { id },
      include: {
        creator: {
          select: { id: true, name: true, avatarUrl: true, reputation: true, university: { select: { name: true } } },
        },
        _count: { select: { bids: true, submissions: true, comments: true } },
      },
    });
  },

  async findMany({ skip, take, where, orderBy }) {
    const [bounties, total] = await Promise.all([
      prismaRead.bounty.findMany({
        where,
        orderBy: orderBy || { createdAt: 'desc' },
        skip,
        take,
        include: {
          creator: {
            select: { id: true, name: true, avatarUrl: true, university: { select: { name: true } } },
          },
          _count: { select: { bids: true, submissions: true, comments: true } },
        },
      }),
      prismaRead.bounty.count({ where }),
    ]);
    return { bounties, total };
  },

  // Full-text search using PostgreSQL
  async search(query, skip, take) {
    const terms = query.trim().split(/\s+/).join(' & ');
    const where = {
      OR: [
        { title: { contains: query, mode: 'insensitive' } },
        { description: { contains: query, mode: 'insensitive' } },
      ],
    };

    const [bounties, total] = await Promise.all([
      prismaRead.bounty.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          creator: {
            select: { id: true, name: true, avatarUrl: true, university: { select: { name: true } } },
          },
          _count: { select: { bids: true, submissions: true } },
        },
      }),
      prismaRead.bounty.count({ where }),
    ]);
    return { bounties, total };
  },

  // Trending bounties (highest reward, open, recent)
  async getTrending(limit = 10) {
    return prismaRead.bounty.findMany({
      where: { status: 'OPEN' },
      orderBy: { rewardPoints: 'desc' },
      take: limit,
      include: {
        creator: {
          select: { id: true, name: true, avatarUrl: true, university: { select: { name: true } } },
        },
        _count: { select: { bids: true, submissions: true } },
      },
    });
  },
};

module.exports = bountyRepository;
