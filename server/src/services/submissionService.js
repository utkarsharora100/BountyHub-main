const { Prisma } = require('@prisma/client');
const submissionRepository = require('../repositories/submissionRepository');
const { prisma } = require('../config/database');
const { cacheInvalidate } = require('../config/redis');
const { publishBountyEvent } = require('./eventBus');
const AppError = require('../utils/AppError');

function assertBountyAcceptsSubmission(bounty) {
  if (!bounty) throw new AppError('Bounty not found', 404);
  if (bounty.status === 'COMPLETED' || bounty.status === 'CANCELLED') {
    throw new AppError('Bounty is closed', 400);
  }
  if (bounty.deadline && new Date(bounty.deadline) <= new Date()) {
    throw new AppError('Bounty deadline has passed', 400);
  }
}

const submissionService = {
  async submitWork(userId, bountyId, data) {
    const submission = await prisma.$transaction(async (tx) => {
      const bounty = await tx.bounty.findUnique({
        where: { id: bountyId },
        include: { bids: { where: { status: 'ACCEPTED' }, select: { bidderId: true } } },
      });
      assertBountyAcceptsSubmission(bounty);

      if (bounty.status === 'IN_PROGRESS') {
        const acceptedBid = bounty.bids[0];
        if (acceptedBid && acceptedBid.bidderId !== userId) {
          throw new AppError('Only the accepted bidder can submit work for this bounty', 403);
        }
      }

      return tx.submission.create({
        data: {
          bountyId,
          submittedBy: userId,
          submissionLink: data.submissionLink,
          description: data.description || null,
        },
      });
    });
    await cacheInvalidate('bounties:*');
    await cacheInvalidate('trending:*');
    await publishBountyEvent('bounty.upserted', bountyId, { reason: 'submission.created' });
    return submission;
  },

  async reviewSubmission(userId, submissionId, status) {
    if (!['ACCEPTED', 'REJECTED', 'UNDER_REVIEW'].includes(status)) {
      throw new AppError('Invalid status', 400);
    }

    let updated;
    try {
      updated = await prisma.$transaction(async (tx) => {
        const submission = await tx.submission.findUnique({
          where: { id: submissionId },
          include: { bounty: true },
        });

        if (!submission) throw new AppError('Submission not found', 404);
        if (submission.bounty.createdBy !== userId) throw new AppError('Not authorized', 403);
        if (submission.status === 'ACCEPTED') throw new AppError('Submission already accepted', 400);

        const claimedSubmission = await tx.submission.updateMany({
          where: { id: submissionId, status: { not: 'ACCEPTED' } },
          data: { status },
        });
        if (claimedSubmission.count !== 1) {
          throw new AppError('Submission already processed', 409);
        }

        if (status === 'ACCEPTED') {
          const claimedBounty = await tx.bounty.updateMany({
            where: { id: submission.bountyId, status: { notIn: ['COMPLETED', 'CANCELLED'] } },
            data: { status: 'COMPLETED' },
          });
          if (claimedBounty.count !== 1) {
            throw new AppError('Bounty is already closed', 409);
          }

          await tx.reputationLog.create({
            data: {
              userId: submission.submittedBy,
              points: submission.bounty.rewardPoints,
              reason: `Completed bounty: ${submission.bounty.title}`,
            },
          });
          await tx.user.update({
            where: { id: submission.submittedBy },
            data: { reputation: { increment: submission.bounty.rewardPoints } },
          });
        }

        return tx.submission.findUnique({
          where: { id: submissionId },
          include: {
            submitter: { select: { id: true, name: true, avatarUrl: true, reputation: true } },
            bounty: true,
          },
        });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (err) {
      if (err.code === 'P2034') throw new AppError('Concurrent submission update detected, please retry', 409);
      throw err;
    }

    if (status === 'ACCEPTED') {
      await cacheInvalidate('leaderboard:*');
      await cacheInvalidate('bounties:*');
      await cacheInvalidate('trending:*');
      await publishBountyEvent('bounty.closed', updated.bountyId, { reason: 'submission.accepted' });
    } else {
      await cacheInvalidate('bounties:*');
      await publishBountyEvent('bounty.upserted', updated.bountyId, { reason: 'submission.reviewed' });
    }

    return updated;
  },

  async getSubmissionsForBounty(bountyId, page, limit) {
    return submissionRepository.findByBounty(bountyId, (page - 1) * limit, limit);
  },
};

module.exports = submissionService;
