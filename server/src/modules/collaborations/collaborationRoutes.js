const express = require('express');
const router = express.Router();
const collabController = require('./collaborationController');
const { authenticate, requireProjectRole } = require('../../middleware/auth');

router.use(authenticate);

// Offers & Agreements
router.post('/projects/:projectId', requireProjectRole(['owner']), collabController.createOffer);
router.get('/projects/:projectId', requireProjectRole(['owner', 'contributor', 'reviewer', 'viewer']), collabController.listProjectOffers);
router.get('/my', collabController.getMyOffers);
router.get('/ledger', collabController.getFinancialLedger);
router.put('/:offerId/respond', collabController.respondToOffer);
router.put('/:offerId/submit-deliverable', collabController.submitMilestoneDeliverable);
router.put('/:offerId/review-milestone', collabController.reviewMilestone);

// Collaboration Requests / Applications
router.post('/projects/:projectId/requests', collabController.createCollaborationRequest);
router.get('/projects/:projectId/requests', requireProjectRole(['owner']), collabController.listProjectCollaborationRequests);
router.put('/requests/:requestId/respond', collabController.respondToCollaborationRequest);

module.exports = router;
