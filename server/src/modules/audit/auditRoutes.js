const express = require('express');
const router = express.Router();
const { getRecentAuditEvents } = require('./auditService');
const { authenticate } = require('../../middleware/auth');

router.get('/', authenticate, async (req, res, next) => {
  try {
    const limit = Number(req.query.limit) || 50;
    const events = await getRecentAuditEvents(limit);
    res.json({ auditEvents: events });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
