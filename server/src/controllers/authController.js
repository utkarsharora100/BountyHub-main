// ─── Auth Controller ─────────────────────────────────────────
const authService = require('../services/authService');
const { prisma } = require('../config/database');

const authController = {
  async register(req, res, next) {
    try {
      const { universityName, universityCountry, ...userData } = req.body;

      // Find or create the university dynamically if a name was provided
      if (universityName) {
        let uni = await prisma.university.findUnique({
          where: { name: universityName }
        });

        if (!uni) {
          uni = await prisma.university.create({
            data: {
              name: universityName,
              country: universityCountry || 'Unknown'
            }
          });
        }
        userData.universityId = uni.id;
      }

      const result = await authService.register(userData);

      // The service layer defaults to STUDENT and bakes that into the initial JWT.
      // We update the DB, then re-login to generate a fresh token with the STAFF role.
      if (userData.role === 'STAFF') {
        await prisma.user.update({
          where: { email: userData.email },
          data: { role: 'STAFF' }
        });
        
        const freshSession = await authService.login({ 
          email: userData.email, 
          password: userData.password 
        });
        return res.status(201).json(freshSession);
      }

      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  },

  async login(req, res, next) {
    try {
      const result = await authService.login(req.body);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },

  async logout(_req, res) {
    // JWT is stateless; client discards the token
    res.json({ message: 'Logged out successfully' });
  },

  async me(req, res, next) {
    try {
      const userService = require('../services/userService');
      const profile = await userService.getProfile(req.user.id);
      res.json(profile);
    } catch (err) {
      next(err);
    }
  },
};

module.exports = authController;
