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
  async existsById(id) {
    const row = await prismaRead.bounty.findUnique({ where: { id }, select: { id: true } });
    return row !== null;
  },

  async findById(id) {
    return prismaRead.bounty.findUnique({
      where: { id },
      include: {
        creator: {
          select: { id: true, name: true, avatarUrl: true, reputation: true, universityId: true, university: { select: { name: true } } },
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
    const where = {
      status: { notIn: ['CANCELLED'] },
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
        },
      }),
      prismaRead.bounty.count({ where }),
    ]);
    return { bounties, total };
  },

  // Lightweight title-only lookup for autocomplete fallback.
  async searchTitles(prefix, take = 8) {
    const rows = await prismaRead.bounty.findMany({
      where: {
        title: { contains: prefix, mode: 'insensitive' },
      },
      select: { title: true },
      take,
      distinct: ['title'],
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => r.title.toLowerCase());
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
