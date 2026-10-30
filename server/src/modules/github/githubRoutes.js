const express = require('express');
const router = express.Router();
const githubController = require('./githubController');
const { authenticate, requireProjectRole } = require('../../middleware/auth');

// Public/Webhook endpoint
router.post('/webhooks', githubController.handleWebhook);

// Authenticated project GitHub management
router.post('/projects/:projectId/link', authenticate, requireProjectRole(['owner']), githubController.linkRepository);
router.get('/projects/:projectId', authenticate, requireProjectRole(['owner', 'contributor', 'reviewer', 'viewer']), githubController.getRepository);
router.post('/projects/:projectId/simulate', authenticate, requireProjectRole(['owner', 'contributor']), githubController.simulateWebhookEvent);
router.post('/projects/:projectId/commit', authenticate, requireProjectRole(['owner', 'contributor']), githubController.commitToGitHub);

module.exports = router;
