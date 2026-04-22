// ─── Bid Repository ─────────────────────────────────────────
const { prisma, prismaRead } = require('../config/database');

const bidRepository = {
  async create(data) {
    return prisma.bid.create({ data });
  },

  async updateStatus(id, status) {
    return prisma.bid.update({ where: { id }, data: { status } });
  },

  async findById(id) {
    return prismaRead.bid.findUnique({
      where: { id },
      include: { bidder: { select: { id: true, name: true } }, bounty: true },
    });
  },

  async findByBounty(bountyId, skip, take) {
    const [bids, total] = await Promise.all([
      prismaRead.bid.findMany({
        where: { bountyId },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        include: {
          bidder: {
            select: { id: true, name: true, avatarUrl: true, reputation: true, university: { select: { name: true } } },
          },
        },
      }),
      prismaRead.bid.count({ where: { bountyId } }),
    ]);
    return { bids, total };
  },

  async findByBidder(userId, skip, take) {
    const [bids, total] = await Promise.all([
      prismaRead.bid.findMany({
        where: { bidderId: userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        include: {
          bounty: { select: { id: true, title: true, category: true, status: true, rewardPoints: true } },
        },
      }),
      prismaRead.bid.count({ where: { bidderId: userId } }),
    ]);
    return { bids, total };
  },

  // Reject all other pending bids for a bounty
  async rejectOtherBids(bountyId, acceptedBidId) {
    return prisma.bid.updateMany({
      where: { bountyId, id: { not: acceptedBidId }, status: 'PENDING' },
      data: { status: 'REJECTED' },
    });
  },
};

module.exports = bidRepository;
