// ─── User Routes ─────────────────────────────────────────────
const { Router } = require('express');
const { authenticate } = require('../middleware/auth');
const userController = require('../controllers/userController');

const router = Router();

router.get('/leaderboard', userController.getLeaderboard);
// Must come before /:id or Express will treat "universities" as an id param
router.get('/universities', userController.getUniversities);
router.get('/:id', userController.getProfile);
router.put('/profile', authenticate, userController.updateProfile);
router.get('/:id/reputation', userController.getReputationHistory);

module.exports = router;
