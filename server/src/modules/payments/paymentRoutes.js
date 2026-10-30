const express = require('express');
const router = express.Router();
const paymentController = require('./paymentController');
const { authenticate } = require('../../middleware/auth');

// Public/Webhook provider confirmation endpoint (FR-34)
router.post('/sandbox/confirm', paymentController.confirmSandboxPayment);

// Authenticated user endpoints
router.post('/initiate', authenticate, paymentController.initiatePayment);
router.get('/history', authenticate, paymentController.getPaymentHistory);
router.get('/receipt/:paymentId', authenticate, paymentController.getPaymentReceipt);

module.exports = router;
