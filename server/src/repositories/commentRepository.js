// ─── Comment Repository ─────────────────────────────────────
const { prisma, prismaRead } = require('../config/database');

const commentRepository = {
  async create(data) {
    return prisma.comment.create({ data });
  },

  async findByBounty(bountyId, skip, take) {
    const [comments, total] = await Promise.all([
      prismaRead.comment.findMany({
        where: { bountyId },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        include: {
          user: {
            select: { id: true, name: true, avatarUrl: true, reputation: true },
          },
        },
      }),
      prismaRead.comment.count({ where: { bountyId } }),
    ]);
    return { comments, total };
  },

  async delete(id) {
    return prisma.comment.delete({ where: { id } });
  },
};

module.exports = commentRepository;
