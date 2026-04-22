const { Router } = require('express');
const universityController = require('../controllers/universityController');

const router = Router();

router.get('/', universityController.list);

module.exports = router;
