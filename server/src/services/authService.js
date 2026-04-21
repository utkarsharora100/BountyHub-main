// ─── Auth Service ────────────────────────────────────────────
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config');
const userRepository = require('../repositories/userRepository');
const AppError = require('../utils/AppError');

const authService = {
  async register({ name, email, password, universityId }) {
    const existing = await userRepository.findByEmail(email);
    if (existing) throw new AppError('Email already registered', 409);

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await userRepository.create({
      name,
      email,
      passwordHash,
      universityId: parseInt(universityId),
    });

    const token = generateToken(user);
    return { user: sanitize(user), token };
  },

  async login({ email, password }) {
    const user = await userRepository.findByEmail(email);
    if (!user) throw new AppError('Invalid email or password', 401);

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw new AppError('Invalid email or password', 401);

    const token = generateToken(user);
    return { user: sanitize(user), token };
  },
};

function generateToken(user) {
  return jwt.sign({ id: user.id, email: user.email, role: user.role }, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
  });
}

function sanitize(user) {
  const { passwordHash, ...safe } = user;
  return safe;
}

module.exports = authService;
