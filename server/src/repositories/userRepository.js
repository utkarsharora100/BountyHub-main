// ─── User Repository (Data Access Layer) ────────────────────
const { prisma, prismaRead } = require('../config/database');

const userRepository = {
  // WRITE operations → master
  async create(data) {
    // Include university so callers don't need a second round-trip just to get the name.
    return prisma.user.create({ data, include: { university: true } });
  },

  async updateReputation(userId, points) {
    return prisma.user.update({
      where: { id: userId },
      data: { reputation: { increment: points } },
    });
  },

  async update(userId, data) {
    return prisma.user.update({ where: { id: userId }, data });
  },

  // READ operations → read replica
  async findByEmail(email) {
    // Include university so the login response has the full profile — avoids a second fetch.
    return prismaRead.user.findUnique({ where: { email }, include: { university: true } });
  },

  async findById(id) {
    return prismaRead.user.findUnique({
      where: { id },
      include: { university: true },
    });
  },

  async getLeaderboard(limit = 10) {
    return prismaRead.user.findMany({
      orderBy: { reputation: 'desc' },
      take: limit,
      select: {
        id: true,
        name: true,
        avatarUrl: true,
        reputation: true,
        university: { select: { name: true, country: true } },
      },
    });
  },

  async getReputationHistory(userId, skip, take) {
    const [logs, total] = await Promise.all([
      prismaRead.reputationLog.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      prismaRead.reputationLog.count({ where: { userId } }),
    ]);
    return { logs, total };
  },

  // Universities don't change at runtime (seeded once), so read replica is fine here.
  async getAllUniversities() {
    return prismaRead.university.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true, country: true },
    });
  },
};

module.exports = userRepository;
