// ─── Reputation Repository ───────────────────────────────────
const { prisma } = require('../config/database');

const reputationRepository = {
  async addLog(userId, points, reason) {
    // Transaction: add log entry + update user reputation atomically
    return prisma.$transaction([
      prisma.reputationLog.create({
        data: { userId, points, reason },
      }),
      prisma.user.update({
        where: { id: userId },
        data: { reputation: { increment: points } },
      }),
    ]);
  },
};

module.exports = reputationRepository;
