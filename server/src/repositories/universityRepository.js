const { prismaRead } = require('../config/database');

const universityRepository = {
  async findMany() {
    return prismaRead.university.findMany({
      orderBy: [{ country: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true, country: true },
    });
  },
};

module.exports = universityRepository;
