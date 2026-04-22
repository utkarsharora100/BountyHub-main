// ─── Comment Service ─────────────────────────────────────────
const commentRepository = require('../repositories/commentRepository');
const bountyRepository = require('../repositories/bountyRepository');
const AppError = require('../utils/AppError');

const commentService = {
  async addComment(userId, bountyId, content) {
    const exists = await bountyRepository.existsById(bountyId);
    if (!exists) throw new AppError('Bounty not found', 404);

    return commentRepository.create({ bountyId, userId, content });
  },

  async getComments(bountyId, page, limit) {
    return commentRepository.findByBounty(bountyId, (page - 1) * limit, limit);
  },
};

module.exports = commentService;
