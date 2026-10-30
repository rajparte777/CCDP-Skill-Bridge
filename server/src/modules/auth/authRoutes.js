const express = require('express');
const router = express.Router();
const authController = require('./authController');
const { authenticate } = require('../../middleware/auth');

// Standard Email/Password Auth
router.post('/register', authController.register);
router.post('/login', authController.login);
router.get('/me', authenticate, authController.getMe);
router.post('/logout', authenticate, authController.logout);

// Password Management & Security
router.put('/change-password', authenticate, authController.changePassword);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);
router.get('/security-logs', authenticate, authController.getUserSecurityLogs);

// GitHub OAuth Endpoints (FR-20)
router.get('/github/status', authController.getGitHubAuthStatus);
router.get('/github', authController.initiateGitHubAuth);
router.get('/github/callback', authController.handleGitHubCallback);
router.get('/github/sandbox', authController.handleGitHubSandboxAuth);

module.exports = router;
