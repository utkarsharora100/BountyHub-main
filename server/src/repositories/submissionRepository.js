// ─── Submission Repository ───────────────────────────────────
const { prisma, prismaRead } = require('../config/database');

const submissionRepository = {
  async create(data) {
    return prisma.submission.create({ data });
  },

  async updateStatus(id, status) {
    return prisma.submission.update({ where: { id }, data: { status } });
  },

  async findById(id) {
    return prismaRead.submission.findUnique({
      where: { id },
      include: {
        submitter: { select: { id: true, name: true, avatarUrl: true, reputation: true } },
        bounty: true,
      },
    });
  },

  async findByBounty(bountyId, skip, take) {
    const [submissions, total] = await Promise.all([
      prismaRead.submission.findMany({
        where: { bountyId },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        include: {
          submitter: {
            select: { id: true, name: true, avatarUrl: true, reputation: true },
          },
        },
      }),
      prismaRead.submission.count({ where: { bountyId } }),
    ]);
    return { submissions, total };
  },
};

module.exports = submissionRepository;
