// ─── Search Routes ───────────────────────────────────────────
const { Router } = require('express');
const searchController = require('../controllers/searchController');

const router = Router();

router.get('/suggestions', searchController.suggestions);
router.get('/matches', searchController.matches);
router.get('/unmet-demand', searchController.unmetDemand);

module.exports = router;
