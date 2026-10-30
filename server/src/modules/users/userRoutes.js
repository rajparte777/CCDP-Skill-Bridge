const express = require('express');
const router = express.Router();
const userController = require('./userController');
const { authenticate, optionalAuth } = require('../../middleware/auth');

router.get('/skills', userController.getAllSkills);
router.get('/', optionalAuth, userController.listUsers);
router.get('/:userId', optionalAuth, userController.getProfile);
router.put('/profile', authenticate, userController.updateProfile);

module.exports = router;
