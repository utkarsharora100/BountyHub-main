// ─── Main Route Index ────────────────────────────────────────
const { Router } = require('express');
const authRoutes = require('./authRoutes');
const userRoutes = require('./userRoutes');
const bountyRoutes = require('./bountyRoutes');
const searchRoutes = require('./searchRoutes');
const universityRoutes = require('./universityRoutes');

const router = Router();

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/bounties', bountyRoutes);
router.use('/search', searchRoutes);
router.use('/universities', universityRoutes);

// Health check
router.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

module.exports = router;
