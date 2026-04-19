// ─── Express Server Entry Point ──────────────────────────────
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const config = require('./config');
const logger = require('./utils/logger');
const routes = require('./routes');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// ── Security Middleware ─────────────────────────────────────
app.use(helmet());
app.use(
  cors({
    origin: config.clientUrl,
    credentials: true,
  })
);

// ── Rate Limiting ───────────────────────────────────────────
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
});
app.use('/api', limiter);

// ── Body Parsing ────────────────────────────────────────────
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: false }));

// ── Logging ─────────────────────────────────────────────────
app.use(morgan('dev'));

// ── API Routes ──────────────────────────────────────────────
app.use('/api', routes);

// ── Error Handler ───────────────────────────────────────────
app.use(errorHandler);

// ── Start Server ────────────────────────────────────────────
app.listen(config.port, () => {
  logger.info(`Server running on port ${config.port} [${config.nodeEnv}]`);
});

module.exports = app;
