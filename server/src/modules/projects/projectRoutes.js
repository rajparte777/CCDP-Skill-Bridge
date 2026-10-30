const express = require('express');
const router = express.Router();
const projectController = require('./projectController');
const { authenticate, optionalAuth, requireProjectRole } = require('../../middleware/auth');

router.get('/feed', optionalAuth, projectController.getActivityFeed);
router.get('/', optionalAuth, projectController.listProjects);
router.get('/:projectId', optionalAuth, projectController.getProjectById);
router.post('/', authenticate, projectController.createProject);
router.put('/:projectId', authenticate, requireProjectRole(['owner']), projectController.updateProject);

// Members
router.post('/:projectId/members', authenticate, requireProjectRole(['owner']), projectController.inviteMember);
router.put('/:projectId/members/:memberUserId', authenticate, requireProjectRole(['owner']), projectController.updateMemberRole);
router.delete('/:projectId/members/:memberUserId', authenticate, requireProjectRole(['owner', 'contributor', 'reviewer', 'viewer']), projectController.removeMember);

module.exports = router;
