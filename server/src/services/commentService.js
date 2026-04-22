// ─── Comment Service ─────────────────────────────────────────
const commentRepository = require('../repositories/commentRepository');
const bountyRepository = require('../repositories/bountyRepository');
const { cacheInvalidate } = require('../config/redis');
const { publishBountyEvent } = require('./eventBus');
const AppError = require('../utils/AppError');

const commentService = {
  async addComment(userId, bountyId, content) {
    const exists = await bountyRepository.existsById(bountyId);
    if (!exists) throw new AppError('Bounty not found', 404);

    const comment = await commentRepository.create({ bountyId, userId, content });
    await cacheInvalidate('bounties:*');
    await publishBountyEvent('bounty.upserted', bountyId, { reason: 'comment.created' });
    return comment;
  },

  async getComments(bountyId, page, limit) {
    return commentRepository.findByBounty(bountyId, (page - 1) * limit, limit);
  },
};

module.exports = commentService;
