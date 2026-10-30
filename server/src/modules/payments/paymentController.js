const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const db = require('../../config/db');
const env = require('../../config/env');
const { createNotification } = require('../notifications/notificationService');
const { logAuditEvent } = require('../audit/auditService');

async function initiatePayment(req, res, next) {
  try {
    const { offerId, method = 'sandbox_card' } = req.body;

    if (!offerId) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Offer ID is required.' }
      });
    }

    const offerRes = await db.query('SELECT * FROM collaboration_offers WHERE id = $1', [offerId]);
    if (offerRes.rows.length === 0) {
      return res.status(404).json({
        error: { code: 'OFFER_NOT_FOUND', message: 'Collaboration offer not found.' }
      });
    }

    const offer = offerRes.rows[0];

    // Check authority: only creator or project owner can pay
    if (offer.creator_id !== req.user.id) {
      return res.status(403).json({
        error: { code: 'FORBIDDEN', message: 'Only the project owner / offer creator can initiate payment.' }
      });
    }

    if (offer.status !== 'accepted') {
      return res.status(400).json({
        error: { code: 'OFFER_NOT_ACCEPTED', message: 'Payment can only be initiated for accepted offers.' }
      });
    }

    if (parseFloat(offer.amount) <= 0) {
      return res.status(400).json({
        error: { code: 'FREE_COLLABORATION', message: 'This offer is marked as free collaboration and requires no payment.' }
      });
    }

    // Check if payment already exists
    const existingPayment = await db.query(
      "SELECT * FROM payments WHERE offer_id = $1 AND status IN ('completed', 'pending', 'initiated')",
      [offerId]
    );

    if (existingPayment.rows.length > 0 && existingPayment.rows[0].status === 'completed') {
      return res.status(409).json({
        error: { code: 'ALREADY_PAID', message: 'This offer has already been completed and paid.' }
      });
    }

    const paymentId = uuidv4();
    const providerReference = `SANDBOX_TX_${Date.now()}_${uuidv4().slice(0, 8).toUpperCase()}`;

    const result = await db.query(
      `INSERT INTO payments (id, offer_id, provider_reference, amount, currency, status, method, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, 'initiated', $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING *`,
      [paymentId, offerId, providerReference, offer.amount, offer.currency, method]
    );

    await logAuditEvent({
      actorId: req.user.id,
      action: 'PAYMENT_INITIATED',
      entityType: 'PAYMENT',
      entityId: paymentId,
      details: { offerId, amount: offer.amount, providerReference }
    });

    res.status(201).json({
      message: 'Payment session initiated in provider sandbox',
      payment: result.rows[0],
      providerEndpoint: '/api/payments/sandbox/confirm'
    });
  } catch (err) {
    next(err);
  }
}

async function confirmSandboxPayment(req, res, next) {
  try {
    const { provider_reference, status = 'completed' } = req.body;

    if (!provider_reference) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Provider reference is required.' }
      });
    }

    if (!['completed', 'failed'].includes(status)) {
      return res.status(400).json({
        error: { code: 'INVALID_STATUS', message: "Status must be 'completed' or 'failed'." }
      });
    }

    const paymentRes = await db.query('SELECT * FROM payments WHERE provider_reference = $1', [provider_reference]);
    if (paymentRes.rows.length === 0) {
      return res.status(404).json({
        error: { code: 'PAYMENT_NOT_FOUND', message: 'Payment reference not recognized.' }
      });
    }

    const payment = paymentRes.rows[0];

    // Idempotency check (FR-34, NFR-07)
    if (payment.status === 'completed') {
      return res.json({
        message: 'Payment was already confirmed',
        payment
      });
    }

    const updateRes = await db.query(
      `UPDATE payments
       SET status = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [status, payment.id]
    );

    const updatedPayment = updateRes.rows[0];

    // Fetch offer to notify contributor & creator
    const offerRes = await db.query(
      `SELECT o.*, p.title as project_title, u_contrib.name as contributor_name, u_creator.name as creator_name
       FROM collaboration_offers o
       JOIN projects p ON o.project_id = p.id
       JOIN users u_contrib ON o.contributor_id = u_contrib.id
       JOIN users u_creator ON o.creator_id = u_creator.id
       WHERE o.id = $1`,
      [payment.offer_id]
    );

    if (offerRes.rows.length > 0) {
      const offer = offerRes.rows[0];

      if (status === 'completed') {
        // Mark offer as completed
        await db.query("UPDATE collaboration_offers SET status = 'completed' WHERE id = $1", [offer.id]);

        // Notify contributor
        await createNotification({
          userId: offer.contributor_id,
          type: 'PAYMENT_RECEIVED',
          message: `Payment of ${payment.currency} ${payment.amount} for "${offer.project_title}" was confirmed.`,
          relatedEntityType: 'PAYMENT',
          relatedEntityId: payment.id
        });

        // Notify creator
        await createNotification({
          userId: offer.creator_id,
          type: 'PAYMENT_PROCESSED',
          message: `Your payment of ${payment.currency} ${payment.amount} for "${offer.project_title}" has settled.`,
          relatedEntityType: 'PAYMENT',
          relatedEntityId: payment.id
        });
      }
    }

    await logAuditEvent({
      actorId: req.user ? req.user.id : null,
      action: `PAYMENT_${status.toUpperCase()}`,
      entityType: 'PAYMENT',
      entityId: payment.id,
      details: { providerReference: provider_reference, amount: payment.amount }
    });

    res.json({
      message: `Payment successfully ${status}`,
      payment: updatedPayment
    });
  } catch (err) {
    next(err);
  }
}

async function getPaymentHistory(req, res, next) {
  try {
    const userId = req.user.id;

    const result = await db.query(
      `SELECT pay.*, o.terms, o.project_id, p.title as project_title,
              u_creator.name as payer_name, u_contrib.name as payee_name
       FROM payments pay
       JOIN collaboration_offers o ON pay.offer_id = o.id
       JOIN projects p ON o.project_id = p.id
       JOIN users u_creator ON o.creator_id = u_creator.id
       JOIN users u_contrib ON o.contributor_id = u_contrib.id
       WHERE o.creator_id = $1 OR o.contributor_id = $1
       ORDER BY pay.created_at DESC`,
      [userId]
    );

    res.json({ payments: result.rows });
  } catch (err) {
    next(err);
  }
}

async function getPaymentReceipt(req, res, next) {
  try {
    const { paymentId } = req.params;
    const userId = req.user.id;

    const result = await db.query(
      `SELECT pay.*, o.terms, o.milestone_title, o.creator_id, o.contributor_id,
              p.title as project_title,
              u_creator.name as payer_name, u_creator.email as payer_email,
              u_contrib.name as payee_name, u_contrib.email as payee_email
       FROM payments pay
       JOIN collaboration_offers o ON pay.offer_id = o.id
       JOIN projects p ON o.project_id = p.id
       JOIN users u_creator ON o.creator_id = u_creator.id
       JOIN users u_contrib ON o.contributor_id = u_contrib.id
       WHERE pay.id = $1`,
      [paymentId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: { code: 'PAYMENT_NOT_FOUND', message: 'Payment record not found.' }
      });
    }

    const pay = result.rows[0];
    if (pay.creator_id !== userId && pay.contributor_id !== userId) {
      return res.status(403).json({
        error: { code: 'FORBIDDEN', message: 'Unauthorized to view this transaction receipt.' }
      });
    }

    const verificationHash = crypto
      .createHmac('sha256', env.JWT_SECRET || 'devcollab-secret')
      .update(`${pay.provider_reference}:${pay.amount}:${pay.currency}:${pay.created_at}`)
      .digest('hex');

    res.json({
      receipt: {
        ...pay,
        receipt_number: `REC-${pay.id.slice(0, 8).toUpperCase()}`,
        verification_hash: verificationHash,
        escrow_fee: '0.00',
        total_settled: pay.amount,
        issued_at: pay.updated_at
      }
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  initiatePayment,
  confirmSandboxPayment,
  getPaymentHistory,
  getPaymentReceipt
};
