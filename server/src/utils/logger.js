const winston = require('winston');
const config = require('../config');

const logger = winston.createLogger({
  level: config.nodeEnv === 'development' ? 'debug' : 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.printf(({ timestamp, level, message, stack }) =>
      `${timestamp} [${level.toUpperCase()}]: ${stack || message}`
    )
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, stack }) =>
          `${timestamp} [${level}]: ${stack || message}`
        )
      ),
    }),
  ],
});

module.exports = logger;
