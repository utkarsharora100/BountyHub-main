const universityService = require('../services/universityService');

const universityController = {
  async list(_req, res, next) {
    try {
      const universities = await universityService.list();
      res.json(universities);
    } catch (err) {
      next(err);
    }
  },
};

module.exports = universityController;
