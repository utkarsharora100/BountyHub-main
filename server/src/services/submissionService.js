// ─── Submission Service ──────────────────────────────────────
const submissionRepository = require('../repositories/submissionRepository');
const bountyRepository = require('../repositories/bountyRepository');
const reputationRepository = require('../repositories/reputationRepository');
const { cacheInvalidate } = require('../config/redis');
const AppError = require('../utils/AppError');

const submissionService = {
  async submitWork(userId, bountyId, data) {
    const bounty = await bountyRepository.findById(bountyId);
    if (!bounty) throw new AppError('Bounty not found', 404);
    if (bounty.status === 'COMPLETED' || bounty.status === 'CANCELLED') {
      throw new AppError('Bounty is closed', 400);
    }

    return submissionRepository.create({
      bountyId,
      submittedBy: userId,
      submissionLink: data.submissionLink,
      description: data.description || null,
    });
  },

  async reviewSubmission(userId, submissionId, status) {
    const submission = await submissionRepository.findById(submissionId);
    if (!submission) throw new AppError('Submission not found', 404);
    if (submission.bounty.createdBy !== userId) throw new AppError('Not authorized', 403);

    if (!['ACCEPTED', 'REJECTED', 'UNDER_REVIEW'].includes(status)) {
      throw new AppError('Invalid status', 400);
    }

    const updated = await submissionRepository.updateStatus(submissionId, status);

    // If accepted, reward reputation and mark bounty complete
    if (status === 'ACCEPTED') {
      const bounty = submission.bounty;
      await reputationRepository.addLog(
        submission.submittedBy,
        bounty.rewardPoints,
        `Completed bounty: ${bounty.title}`
      );
      await bountyRepository.update(bounty.id, { status: 'COMPLETED' });
      await cacheInvalidate('leaderboard:*');
      await cacheInvalidate('bounties:*');
      await cacheInvalidate('trending:*');
    }

    return updated;
  },

  async getSubmissionsForBounty(bountyId, page, limit) {
    return submissionRepository.findByBounty(bountyId, (page - 1) * limit, limit);
  },
};

module.exports = submissionService;
