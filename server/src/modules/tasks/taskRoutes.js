const express = require('express');
const router = express.Router();
const taskController = require('./taskController');
const { authenticate, requireProjectRole } = require('../../middleware/auth');

router.use(authenticate);

router.post('/:projectId', requireProjectRole(['owner', 'contributor', 'reviewer']), taskController.createTask);
router.get('/:projectId', requireProjectRole(['owner', 'contributor', 'reviewer', 'viewer']), taskController.listProjectTasks);
router.put('/task/:taskId', taskController.updateTask);
router.delete('/task/:taskId', taskController.deleteTask);

module.exports = router;
