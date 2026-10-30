const express = require('express');
const router = express.Router();
const notificationService = require('./notificationService');
const { authenticate } = require('../../middleware/auth');

router.use(authenticate);

router.get('/', async (req, res, next) => {
  try {
    const notifications = await notificationService.getUserNotifications(req.user.id);
    res.json({ notifications });
  } catch (err) {
    next(err);
  }
});

router.put('/:notificationId/read', async (req, res, next) => {
  try {
    await notificationService.markAsRead(req.params.notificationId, req.user.id);
    res.json({ message: 'Marked as read' });
  } catch (err) {
    next(err);
  }
});

router.put('/read-all', async (req, res, next) => {
  try {
    await notificationService.markAllAsRead(req.user.id);
    res.json({ message: 'All notifications marked as read' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
