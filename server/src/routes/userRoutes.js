// ─── User Routes ─────────────────────────────────────────────
const { Router } = require('express');
const { authenticate } = require('../middleware/auth');
const userController = require('../controllers/userController');

const router = Router();

router.get('/leaderboard', userController.getLeaderboard);
router.get('/:id', userController.getProfile);
router.put('/profile', authenticate, userController.updateProfile);
router.get('/:id/reputation', userController.getReputationHistory);

module.exports = router;
