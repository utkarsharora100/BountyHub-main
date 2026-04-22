// ─── Bounty Routes ───────────────────────────────────────────
const { Router } = require('express');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const bountyController = require('../controllers/bountyController');
const bidController = require('../controllers/bidController');
const submissionController = require('../controllers/submissionController');
const commentController = require('../controllers/commentController');

const router = Router();

// ── Bounty CRUD ─────────────────────────────────────────────
router.get('/trending', bountyController.trending);
router.get('/search', bountyController.search);
router.get('/', bountyController.list);
router.get('/:id', bountyController.getById);

router.post(
  '/',
  authenticate,
  [
    body('title').trim().notEmpty().withMessage('Title required').isLength({ max: 300 }),
    body('description').trim().notEmpty().withMessage('Description required'),
    body('rewardPoints').isInt({ min: 1 }).withMessage('Reward points must be positive'),
    body('department').optional({ nullable: true }).isLength({ max: 150 }).withMessage('Department is too long'),
  ],
  validate,
  bountyController.create
);

router.put('/:id', authenticate, bountyController.update);
router.delete('/:id', authenticate, bountyController.delete);

// ── Bids ────────────────────────────────────────────────────
router.get('/:bountyId/bids', bidController.getBidsForBounty);
router.post(
  '/:bountyId/bids',
  authenticate,
  [body('message').trim().notEmpty().withMessage('Bid message required')],
  validate,
  bidController.placeBid
);
router.patch('/bids/:id/accept', authenticate, bidController.acceptBid);
router.patch('/bids/:id/reject', authenticate, bidController.rejectBid);

// ── Submissions ─────────────────────────────────────────────
router.get('/:bountyId/submissions', submissionController.getForBounty);
router.post(
  '/:bountyId/submissions',
  authenticate,
  [body('submissionLink').trim().isURL().withMessage('Valid submission URL required')],
  validate,
  submissionController.submit
);
router.patch('/submissions/:id/review', authenticate, submissionController.review);

// ── Comments ────────────────────────────────────────────────
router.get('/:bountyId/comments', commentController.getForBounty);
router.post(
  '/:bountyId/comments',
  authenticate,
  [body('content').trim().notEmpty().withMessage('Comment content required')],
  validate,
  commentController.add
);

module.exports = router;
