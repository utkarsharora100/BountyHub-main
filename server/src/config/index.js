require('dotenv').config();
const os = require('os');

module.exports = {
  port: process.env.PORT || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:3000',

  db: {
    url: process.env.DATABASE_URL,
    readUrl: process.env.DATABASE_READ_URL || process.env.DATABASE_URL,
  },

  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },

  mongodb: {
    url: process.env.MONGODB_URL,
    readUrl: process.env.MONGODB_READ_URL || process.env.MONGODB_URL,
  },

  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
};
