const { v4: uuidv4 } = require('uuid');
const db = require('../../config/db');
const { createNotification } = require('../notifications/notificationService');
const { logAuditEvent } = require('../audit/auditService');

async function createOffer(req, res, next) {
  try {
    const { projectId } = req.params;
    const {
      contributor_id,
      terms,
      amount = 0,
      currency = 'USD',
      task_id = null,
      milestone_title = ''
    } = req.body;

    if (!contributor_id || !terms || !terms.trim()) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Contributor ID and collaboration terms are required.' }
      });
    }

    // Verify contributor exists
    const userRes = await db.query('SELECT id, name FROM users WHERE id = $1', [contributor_id]);
    if (userRes.rows.length === 0) {
      return res.status(404).json({
        error: { code: 'USER_NOT_FOUND', message: 'Target contributor does not exist.' }
      });
    }

    let resolvedMilestoneTitle = milestone_title.trim();
    let validatedTaskId = null;

    if (task_id) {
      const taskRes = await db.query('SELECT id, title, status FROM tasks WHERE id = $1 AND project_id = $2', [task_id, projectId]);
      if (taskRes.rows.length > 0) {
        validatedTaskId = taskRes.rows[0].id;
        if (!resolvedMilestoneTitle) {
          resolvedMilestoneTitle = taskRes.rows[0].title;
        }
      }
    }

    const offerId = uuidv4();
    const parsedAmount = parseFloat(amount) || 0.00;

    const result = await db.query(
      `INSERT INTO collaboration_offers (
        id, project_id, creator_id, contributor_id, terms, amount, currency, status,
        task_id, milestone_title, milestone_status, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', $8, $9, 'in_progress', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING *`,
      [
        offerId,
        projectId,
        req.user.id,
        contributor_id,
        terms.trim(),
        parsedAmount,
        currency.toUpperCase(),
        validatedTaskId,
        resolvedMilestoneTitle
      ]
    );

    const offer = result.rows[0];

    // Notify contributor (FR-36)
    const isPaid = parsedAmount > 0;
    const offerTypeLabel = isPaid ? `paid (${currency} ${parsedAmount})` : 'free';
    const milestoneNotice = resolvedMilestoneTitle ? ` for milestone "${resolvedMilestoneTitle}"` : '';
    await createNotification({
      userId: contributor_id,
      type: 'COLLABORATION_OFFER',
      message: `${req.user.name} sent you a ${offerTypeLabel} collaboration offer${milestoneNotice} on project "${req.project.title}".`,
      relatedEntityType: 'OFFER',
      relatedEntityId: offerId
    });

    await logAuditEvent({
      actorId: req.user.id,
      action: 'OFFER_CREATED',
      entityType: 'COLLABORATION_OFFER',
      entityId: offerId,
      details: { projectId, contributor_id, amount: parsedAmount, currency, taskId: validatedTaskId }
    });

    res.status(201).json({
      message: 'Collaboration offer created successfully',
      offer
    });
  } catch (err) {
    next(err);
  }
}

async function listProjectOffers(req, res, next) {
  try {
    const { projectId } = req.params;

    const result = await db.query(
      `SELECT o.*, 
              u_creator.name as creator_name, u_creator.avatar_url as creator_avatar,
              u_contrib.name as contributor_name, u_contrib.avatar_url as contributor_avatar,
              t.title as task_title, t.status as task_status,
              pay.id as payment_id, pay.status as payment_status, pay.provider_reference, pay.method as payment_method
       FROM collaboration_offers o
       JOIN users u_creator ON o.creator_id = u_creator.id
       JOIN users u_contrib ON o.contributor_id = u_contrib.id
       LEFT JOIN tasks t ON o.task_id = t.id
       LEFT JOIN payments pay ON o.id = pay.offer_id
       WHERE o.project_id = $1
       ORDER BY o.created_at DESC`,
      [projectId]
    );

    res.json({ offers: result.rows });
  } catch (err) {
    next(err);
  }
}

async function getMyOffers(req, res, next) {
  try {
    const userId = req.user.id;

    const result = await db.query(
      `SELECT o.*, p.title as project_title,
              u_creator.name as creator_name, u_creator.avatar_url as creator_avatar,
              u_contrib.name as contributor_name, u_contrib.avatar_url as contributor_avatar,
              t.title as task_title, t.status as task_status,
              pay.id as payment_id, pay.status as payment_status, pay.provider_reference, pay.method as payment_method
       FROM collaboration_offers o
       JOIN projects p ON o.project_id = p.id
       JOIN users u_creator ON o.creator_id = u_creator.id
       JOIN users u_contrib ON o.contributor_id = u_contrib.id
       LEFT JOIN tasks t ON o.task_id = t.id
       LEFT JOIN payments pay ON o.id = pay.offer_id
       WHERE o.contributor_id = $1 OR o.creator_id = $1
       ORDER BY o.created_at DESC`,
      [userId]
    );

    res.json({ offers: result.rows });
  } catch (err) {
    next(err);
  }
}

async function respondToOffer(req, res, next) {
  try {
    const { offerId } = req.params;
    const { action } = req.body; // 'accepted' or 'declined'
    const userId = req.user.id;

    if (!['accepted', 'declined'].includes(action)) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: "Action must be 'accepted' or 'declined'." }
      });
    }

    const offerRes = await db.query('SELECT * FROM collaboration_offers WHERE id = $1', [offerId]);
    if (offerRes.rows.length === 0) {
      return res.status(404).json({
        error: { code: 'OFFER_NOT_FOUND', message: 'Offer not found.' }
      });
    }

    const offer = offerRes.rows[0];

    if (offer.contributor_id !== userId) {
      return res.status(403).json({
        error: { code: 'FORBIDDEN', message: 'Only the designated contributor can respond to this offer.' }
      });
    }

    if (offer.status !== 'pending') {
      return res.status(409).json({
        error: { code: 'ALREADY_PROCESSED', message: `Offer is already ${offer.status}.` }
      });
    }

    const updateRes = await db.query(
      `UPDATE collaboration_offers
       SET status = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [action, offerId]
    );

    // If accepted, ensure user is a project contributor
    if (action === 'accepted') {
      const memberCheck = await db.query(
        'SELECT id FROM project_members WHERE project_id = $1 AND user_id = $2',
        [offer.project_id, userId]
      );
      if (memberCheck.rows.length === 0) {
        const memberId = uuidv4();
        await db.query(
          `INSERT INTO project_members (id, project_id, user_id, role, joined_at)
           VALUES ($1, $2, $3, 'contributor', CURRENT_TIMESTAMP)`,
          [memberId, offer.project_id, userId]
        );
      }

      // If linked to a task, assign the task to contributor and move to in_progress
      if (offer.task_id) {
        await db.query(
          `UPDATE tasks SET assignee_id = $1, status = 'in_progress', updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
          [userId, offer.task_id]
        );
      }
    }

    // Notify offer creator
    await createNotification({
      userId: offer.creator_id,
      type: action === 'accepted' ? 'OFFER_ACCEPTED' : 'OFFER_DECLINED',
      message: `${req.user.name} ${action} your collaboration offer.`,
      relatedEntityType: 'OFFER',
      relatedEntityId: offerId
    });

    await logAuditEvent({
      actorId: userId,
      action: `OFFER_${action.toUpperCase()}`,
      entityType: 'COLLABORATION_OFFER',
      entityId: offerId
    });

    res.json({
      message: `Offer ${action} successfully`,
      offer: updateRes.rows[0]
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Contributor submits milestone work/deliverables for review (FR-31, FR-32)
 */
async function submitMilestoneDeliverable(req, res, next) {
  try {
    const { offerId } = req.params;
    const { deliverable_note = '', deliverable_url = '' } = req.body;
    const userId = req.user.id;

    const offerRes = await db.query('SELECT * FROM collaboration_offers WHERE id = $1', [offerId]);
    if (offerRes.rows.length === 0) {
      return res.status(404).json({
        error: { code: 'OFFER_NOT_FOUND', message: 'Offer not found.' }
      });
    }

    const offer = offerRes.rows[0];
    if (offer.contributor_id !== userId) {
      return res.status(403).json({
        error: { code: 'FORBIDDEN', message: 'Only the assigned contributor can submit deliverables.' }
      });
    }

    if (!['accepted', 'completed'].includes(offer.status)) {
      return res.status(400).json({
        error: { code: 'INVALID_STATE', message: 'Deliverables can only be submitted for accepted agreements.' }
      });
    }

    const updateRes = await db.query(
      `UPDATE collaboration_offers
       SET milestone_status = 'submitted',
           deliverable_note = $1,
           deliverable_url = $2,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING *`,
      [deliverable_note.trim(), deliverable_url.trim(), offerId]
    );

    // Notify project owner / creator
    await createNotification({
      userId: offer.creator_id,
      type: 'MILESTONE_SUBMITTED',
      message: `${req.user.name} submitted milestone deliverables for "${offer.milestone_title || offer.terms.slice(0, 30)}".`,
      relatedEntityType: 'OFFER',
      relatedEntityId: offerId
    });

    await logAuditEvent({
      actorId: userId,
      action: 'MILESTONE_SUBMITTED',
      entityType: 'COLLABORATION_OFFER',
      entityId: offerId,
      details: { deliverable_note, deliverable_url }
    });

    res.json({
      message: 'Milestone deliverables submitted successfully for review',
      offer: updateRes.rows[0]
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Project Owner reviews milestone deliverable (approve or request revisions)
 */
async function reviewMilestone(req, res, next) {
  try {
    const { offerId } = req.params;
    const { action } = req.body; // 'approved' or 'revisions_requested'
    const userId = req.user.id;

    if (!['approved', 'revisions_requested'].includes(action)) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: "Action must be 'approved' or 'revisions_requested'." }
      });
    }

    const offerRes = await db.query('SELECT * FROM collaboration_offers WHERE id = $1', [offerId]);
    if (offerRes.rows.length === 0) {
      return res.status(404).json({
        error: { code: 'OFFER_NOT_FOUND', message: 'Offer not found.' }
      });
    }

    const offer = offerRes.rows[0];
    if (offer.creator_id !== userId) {
      return res.status(403).json({
        error: { code: 'FORBIDDEN', message: 'Only the project owner / agreement creator can review deliverables.' }
      });
    }

    const newMilestoneStatus = action === 'approved' ? 'approved' : 'in_progress';

    const updateRes = await db.query(
      `UPDATE collaboration_offers
       SET milestone_status = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [newMilestoneStatus, offerId]
    );

    // If approved and linked to a task, mark task completed
    if (action === 'approved' && offer.task_id) {
      await db.query(`UPDATE tasks SET status = 'completed', updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [offer.task_id]);
    }

    await createNotification({
      userId: offer.contributor_id,
      type: action === 'approved' ? 'MILESTONE_APPROVED' : 'MILESTONE_REVISIONS_REQUESTED',
      message: action === 'approved'
        ? `${req.user.name} approved your milestone deliverables! Payment settlement is ready.`
        : `${req.user.name} requested adjustments on your milestone submission.`,
      relatedEntityType: 'OFFER',
      relatedEntityId: offerId
    });

    await logAuditEvent({
      actorId: userId,
      action: `MILESTONE_${action.toUpperCase()}`,
      entityType: 'COLLABORATION_OFFER',
      entityId: offerId
    });

    res.json({
      message: `Milestone ${action === 'approved' ? 'approved' : 'returned for revisions'} successfully`,
      offer: updateRes.rows[0]
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Financial Ledger & Transaction History (FR-35, FR-41, BR-09, UC-11)
 */
async function getFinancialLedger(req, res, next) {
  try {
    const userId = req.user.id;

    // Get all payments related to offers where user is creator or contributor
    const paymentsRes = await db.query(
      `SELECT p.*, o.terms, o.milestone_title, o.creator_id, o.contributor_id,
              proj.id as project_id, proj.title as project_title,
              u_creator.name as creator_name, u_creator.email as creator_email,
              u_contrib.name as contributor_name, u_contrib.email as contributor_email
       FROM payments p
       JOIN collaboration_offers o ON p.offer_id = o.id
       JOIN projects proj ON o.project_id = proj.id
       JOIN users u_creator ON o.creator_id = u_creator.id
       JOIN users u_contrib ON o.contributor_id = u_contrib.id
       WHERE o.creator_id = $1 OR o.contributor_id = $1
       ORDER BY p.created_at DESC`,
      [userId]
    );

    const payments = paymentsRes.rows;

    let totalDisbursed = 0;
    let totalReceived = 0;
    let pendingDisbursements = 0;

    for (const p of payments) {
      const amt = parseFloat(p.amount) || 0;
      if (p.status === 'completed') {
        if (p.creator_id === userId) {
          totalDisbursed += amt;
        }
        if (p.contributor_id === userId) {
          totalReceived += amt;
        }
      } else if (p.status === 'initiated' || p.status === 'pending') {
        if (p.creator_id === userId) {
          pendingDisbursements += amt;
        }
      }
    }

    res.json({
      ledger: payments,
      summary: {
        totalDisbursed: totalDisbursed.toFixed(2),
        totalReceived: totalReceived.toFixed(2),
        pendingDisbursements: pendingDisbursements.toFixed(2),
        totalTransactions: payments.length
      }
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Submit Request to Collaborate on a project (FR-06, FR-13, FR-14, FR-30, FR-31)
 */
async function createCollaborationRequest(req, res, next) {
  try {
    const { projectId } = req.params;
    const { role = 'contributor', pitch } = req.body;
    const userId = req.user.id;

    if (!pitch || !pitch.trim()) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'A brief pitch or explanation of your contribution is required.' }
      });
    }

    // Verify project exists
    const projRes = await db.query('SELECT * FROM projects WHERE id = $1', [projectId]);
    if (projRes.rows.length === 0) {
      return res.status(404).json({
        error: { code: 'PROJECT_NOT_FOUND', message: 'Project not found.' }
      });
    }

    const project = projRes.rows[0];

    // Cannot apply to own project
    if (project.owner_id === userId) {
      return res.status(400).json({
        error: { code: 'OWN_PROJECT', message: 'You are the owner of this project.' }
      });
    }

    // Cannot apply if already a member
    const memberRes = await db.query('SELECT id FROM project_members WHERE project_id = $1 AND user_id = $2', [projectId, userId]);
    if (memberRes.rows.length > 0) {
      return res.status(409).json({
        error: { code: 'ALREADY_MEMBER', message: 'You are already a member of this project.' }
      });
    }

    // Check existing request
    const existingReq = await db.query('SELECT * FROM collaboration_requests WHERE project_id = $1 AND user_id = $2', [projectId, userId]);
    if (existingReq.rows.length > 0 && existingReq.rows[0].status === 'pending') {
      return res.status(409).json({
        error: { code: 'ALREADY_REQUESTED', message: 'You already have a pending collaboration request for this project.' }
      });
    }

    const requestId = uuidv4();
    const result = await db.query(
      `INSERT INTO collaboration_requests (id, project_id, user_id, role, pitch, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, 'pending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING *`,
      [requestId, projectId, userId, role, pitch.trim()]
    );

    // Notify project owner
    await createNotification({
      userId: project.owner_id,
      type: 'COLLABORATION_REQUEST',
      message: `${req.user.name} applied to collaborate as a ${role} on "${project.title}".`,
      relatedEntityType: 'PROJECT',
      relatedEntityId: projectId
    });

    await logAuditEvent({
      actorId: userId,
      action: 'COLLABORATION_REQUEST_CREATED',
      entityType: 'COLLABORATION_REQUEST',
      entityId: requestId,
      details: { projectId, role, pitch }
    });

    res.status(201).json({
      message: 'Collaboration request submitted successfully',
      request: result.rows[0]
    });
  } catch (err) {
    next(err);
  }
}

/**
 * List collaboration requests for a project (Owner only)
 */
async function listProjectCollaborationRequests(req, res, next) {
  try {
    const { projectId } = req.params;

    const result = await db.query(
      `SELECT cr.*, u.name, u.email, u.avatar_url, u.bio, u.github_username
       FROM collaboration_requests cr
       JOIN users u ON cr.user_id = u.id
       WHERE cr.project_id = $1
       ORDER BY cr.created_at DESC`,
      [projectId]
    );

    res.json({ requests: result.rows });
  } catch (err) {
    next(err);
  }
}

/**
 * Respond to collaboration request (Owner accepts or declines)
 */
async function respondToCollaborationRequest(req, res, next) {
  try {
    const { requestId } = req.params;
    const { action } = req.body; // 'accepted' or 'declined'
    const userId = req.user.id;

    if (!['accepted', 'declined'].includes(action)) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: "Action must be 'accepted' or 'declined'." }
      });
    }

    const reqRes = await db.query(
      `SELECT cr.*, p.owner_id, p.title as project_title
       FROM collaboration_requests cr
       JOIN projects p ON cr.project_id = p.id
       WHERE cr.id = $1`,
      [requestId]
    );

    if (reqRes.rows.length === 0) {
      return res.status(404).json({
        error: { code: 'REQUEST_NOT_FOUND', message: 'Collaboration request not found.' }
      });
    }

    const request = reqRes.rows[0];
    if (request.owner_id !== userId) {
      return res.status(403).json({
        error: { code: 'FORBIDDEN', message: 'Only the project owner can respond to collaboration requests.' }
      });
    }

    const updateRes = await db.query(
      `UPDATE collaboration_requests SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *`,
      [action, requestId]
    );

    // If accepted, add applicant to project_members
    if (action === 'accepted') {
      const memberCheck = await db.query(
        'SELECT id FROM project_members WHERE project_id = $1 AND user_id = $2',
        [request.project_id, request.user_id]
      );
      if (memberCheck.rows.length === 0) {
        const memberId = uuidv4();
        await db.query(
          `INSERT INTO project_members (id, project_id, user_id, role, joined_at)
           VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)`,
          [memberId, request.project_id, request.user_id, request.role]
        );
      }
    }

    // Notify applicant
    await createNotification({
      userId: request.user_id,
      type: action === 'accepted' ? 'COLLABORATION_ACCEPTED' : 'COLLABORATION_DECLINED',
      message: action === 'accepted'
        ? `Your request to collaborate on "${request.project_title}" was accepted! You are now a ${request.role}.`
        : `Your request to collaborate on "${request.project_title}" was declined.`,
      relatedEntityType: 'PROJECT',
      relatedEntityId: request.project_id
    });

    await logAuditEvent({
      actorId: userId,
      action: `COLLABORATION_REQUEST_${action.toUpperCase()}`,
      entityType: 'COLLABORATION_REQUEST',
      entityId: requestId
    });

    res.json({
      message: `Collaboration request ${action} successfully`,
      request: updateRes.rows[0]
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createOffer,
  listProjectOffers,
  getMyOffers,
  respondToOffer,
  submitMilestoneDeliverable,
  reviewMilestone,
  getFinancialLedger,
  createCollaborationRequest,
  listProjectCollaborationRequests,
  respondToCollaborationRequest
};
