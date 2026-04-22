const universityRepository = require('../repositories/universityRepository');
const { cacheGet } = require('../config/redis');

const universityService = {
  async list() {
    return cacheGet('universities:list', () => universityRepository.findMany(), 300);
  },
};

module.exports = universityService;
