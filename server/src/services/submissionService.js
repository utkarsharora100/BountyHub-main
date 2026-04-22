// ─── Submission Service ──────────────────────────────────────
const { prisma, prismaRead } = require('../config/database');
const { Prisma } = require('@prisma/client');
const { cacheInvalidate, publishEvent } = require('../config/redis');
const AppError = require('../utils/AppError');

const submissionService = {
  async submitWork(userId, bountyId, data) {
    const bounty = await prismaRead.bounty.findUnique({ where: { id: bountyId } });
    if (!bounty) throw new AppError('Bounty not found', 404);
    if (bounty.status === 'COMPLETED' || bounty.status === 'CANCELLED') {
      throw new AppError('Bounty is closed', 400);
    }

    return prisma.submission.create({
      data: {
        bountyId,
        submittedBy: userId,
        submissionLink: data.submissionLink,
        description: data.description || null,
      },
    });
  },

  async reviewSubmission(userId, submissionId, status) {
    const submission = await prismaRead.submission.findUnique({
      where: { id: submissionId },
      include: {
        bounty: { include: { creator: { select: { universityId: true } } } },
      },
    });
    if (!submission) throw new AppError('Submission not found', 404);
    if (submission.bounty.createdBy !== userId) throw new AppError('Not authorized', 403);

    if (!['ACCEPTED', 'REJECTED', 'UNDER_REVIEW'].includes(status)) {
      throw new AppError('Invalid status', 400);
    }

    if (status === 'ACCEPTED') {
      const points = submission.bounty.rewardPoints;
      const submitterId = submission.submittedBy;
      const bountyId = submission.bounty.id;

      // Single Serializable transaction: mark submission, award reputation, complete bounty
      await prisma.$transaction(async (tx) => {
        await tx.submission.update({ where: { id: submissionId }, data: { status: 'ACCEPTED' } });
        await tx.reputationLog.create({
          data: { userId: submitterId, points, reason: `Completed bounty: ${submission.bounty.title}` },
        });
        await tx.user.update({ where: { id: submitterId }, data: { reputation: { increment: points } } });
        await tx.bounty.update({ where: { id: bountyId }, data: { status: 'COMPLETED' } });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

      await cacheInvalidate('leaderboard:*');
      await cacheInvalidate('bounties:*');
      await cacheInvalidate('trending:*');
      await publishEvent('SUBMISSION_ACCEPTED', {
        bountyId,
        submissionId,
        submittedBy: submitterId,
        universityId: submission.bounty.creator?.universityId,
      });
    } else {
      await prisma.submission.update({ where: { id: submissionId }, data: { status } });
    }

    return prismaRead.submission.findUnique({ where: { id: submissionId } });
  },

  async getSubmissionsForBounty(bountyId, page, limit) {
    const skip = (page - 1) * limit;
    const [submissions, total] = await Promise.all([
      prismaRead.submission.findMany({
        where: { bountyId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          submitter: { select: { id: true, name: true, avatarUrl: true, reputation: true } },
        },
      }),
      prismaRead.submission.count({ where: { bountyId } }),
    ]);
    return { submissions, total };
  },
};

module.exports = submissionService;
