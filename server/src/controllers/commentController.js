// ─── Comment Controller ──────────────────────────────────────
const commentService = require('../services/commentService');
const { paginate, paginatedResponse } = require('../utils/pagination');

const commentController = {
  async add(req, res, next) {
    try {
      const bountyId = parseInt(req.params.bountyId);
      const { content } = req.body;
      const comment = await commentService.addComment(req.user.id, bountyId, content);
      res.status(201).json(comment);
    } catch (err) {
      next(err);
    }
  },

  async getForBounty(req, res, next) {
    try {
      const bountyId = parseInt(req.params.bountyId);
      const { page, limit } = paginate(req.query);
      const { comments, total } = await commentService.getComments(bountyId, page, limit);
      res.json(paginatedResponse(comments, total, page, limit));
    } catch (err) {
      next(err);
    }
  },
};

module.exports = commentController;
