const express = require('express');
const router = express.Router();
const reviewController = require('./reviewController');
const { authenticate, requireProjectRole } = require('../../middleware/auth');

router.use(authenticate);

router.post('/projects/:projectId', requireProjectRole(['owner', 'contributor', 'reviewer']), reviewController.createReview);
router.get('/projects/:projectId', requireProjectRole(['owner', 'contributor', 'reviewer', 'viewer']), reviewController.listProjectReviews);
router.get('/:reviewId', reviewController.getReviewDetails);
router.post('/:reviewId/comments', reviewController.addReviewComment);
router.put('/comments/:commentId/status', reviewController.updateCommentStatus);
router.put('/:reviewId/decision', reviewController.updateReviewDecision);

module.exports = router;
