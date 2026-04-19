// ─── Search Routes ───────────────────────────────────────────
const { Router } = require('express');
const searchController = require('../controllers/searchController');

const router = Router();

router.get('/suggestions', searchController.suggestions);

module.exports = router;
