// ─── Submission Controller ───────────────────────────────────
const submissionService = require('../services/submissionService');
const { paginate, paginatedResponse } = require('../utils/pagination');

const submissionController = {
  async submit(req, res, next) {
    try {
      const bountyId = parseInt(req.params.bountyId);
      const submission = await submissionService.submitWork(req.user.id, bountyId, req.body);
      res.status(201).json(submission);
    } catch (err) {
      next(err);
    }
  },

  async review(req, res, next) {
    try {
      const submissionId = parseInt(req.params.id);
      const { status } = req.body;
      const submission = await submissionService.reviewSubmission(req.user.id, submissionId, status);
      res.json(submission);
    } catch (err) {
      next(err);
    }
  },

  async getForBounty(req, res, next) {
    try {
      const bountyId = parseInt(req.params.bountyId);
      const { page, limit } = paginate(req.query);
      const { submissions, total } = await submissionService.getSubmissionsForBounty(bountyId, page, limit);
      res.json(paginatedResponse(submissions, total, page, limit));
    } catch (err) {
      next(err);
    }
  },
};

module.exports = submissionController;
