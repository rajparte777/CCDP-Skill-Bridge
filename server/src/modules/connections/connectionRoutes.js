const express = require('express');
const router = express.Router();
const connectionController = require('./connectionController');
const { authenticate } = require('../../middleware/auth');

router.use(authenticate);

router.post('/request', connectionController.sendConnectionRequest);
router.put('/:connectionId/respond', connectionController.respondToConnectionRequest);
router.get('/', connectionController.listMyConnections);
router.delete('/:connectionId', connectionController.removeConnection);

module.exports = router;
