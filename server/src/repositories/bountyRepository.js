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

  async expireOpenBefore(now) {
    const expired = await prisma.bounty.findMany({
      where: { status: 'OPEN', deadline: { lt: now } },
      select: { id: true },
    });
    const ids = expired.map((bounty) => bounty.id);
    if (ids.length === 0) return { count: 0, ids: [] };

    await prisma.$transaction([
      prisma.bounty.updateMany({
        where: { id: { in: ids }, status: 'OPEN' },
        data: { status: 'CANCELLED' },
      }),
      prisma.bid.updateMany({
        where: { bountyId: { in: ids }, status: 'PENDING' },
        data: { status: 'REJECTED' },
      }),
    ]);

    return { count: ids.length, ids };
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

  async findByIdForIndex(id) {
    return prisma.bounty.findUnique({
      where: { id },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
            reputation: true,
            university: { select: { name: true, country: true } },
          },
        },
        _count: { select: { bids: true, submissions: true, comments: true } },
      },
    });
  },

  async findIndexableForSearch() {
    return prismaRead.bounty.findMany({
      where: {
        status: 'OPEN',
        OR: [{ deadline: null }, { deadline: { gt: new Date() } }],
      },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
            reputation: true,
            university: { select: { name: true, country: true } },
          },
        },
        _count: { select: { bids: true, submissions: true, comments: true } },
      },
    });
  },

  async findSearchResultsByIds(ids) {
    if (!ids.length) return [];
    return prismaRead.bounty.findMany({
      where: {
        id: { in: ids },
        status: 'OPEN',
        OR: [{ deadline: null }, { deadline: { gt: new Date() } }],
      },
      include: {
        creator: {
          select: { id: true, name: true, avatarUrl: true, university: { select: { name: true } } },
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

  // Search fallback using PostgreSQL when Redis is unavailable.
  async search(query, skip, take) {
    const skillTerms = query.trim().split(/\s+/).filter(Boolean);
    const where = {
      status: 'OPEN',
      AND: [
        { OR: [{ deadline: null }, { deadline: { gt: new Date() } }] },
        {
          OR: [
            { title: { contains: query, mode: 'insensitive' } },
            { description: { contains: query, mode: 'insensitive' } },
            { department: { contains: query, mode: 'insensitive' } },
            { skills: { hasSome: skillTerms } },
          ],
        },
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
          _count: { select: { bids: true, submissions: true, comments: true } },
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
