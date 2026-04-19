// ─── Validation Middleware using express-validator ───────────
const { validationResult } = require('express-validator');

function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const messages = errors.array().map((e) => e.msg);
    return res.status(400).json({ error: 'Validation failed', details: messages });
  }
  next();
}

module.exports = validate;
