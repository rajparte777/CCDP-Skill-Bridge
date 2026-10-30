const { v4: uuidv4 } = require('uuid');
const db = require('../../config/db');
const { createNotification } = require('../notifications/notificationService');
const { logAuditEvent } = require('../audit/auditService');

async function createReview(req, res, next) {
  try {
    const { projectId } = req.params;
    const { title } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Review title is required.' }
      });
    }

    const reviewId = uuidv4();
    const result = await db.query(
      `INSERT INTO reviews (id, project_id, author_id, title, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'pending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING *`,
      [reviewId, projectId, req.user.id, title.trim()]
    );

    const review = result.rows[0];

    // Notify project owner/reviewers
    const membersRes = await db.query(
      "SELECT user_id FROM project_members WHERE project_id = $1 AND role IN ('owner', 'reviewer')",
      [projectId]
    );

    for (const member of membersRes.rows) {
      if (member.user_id !== req.user.id) {
        await createNotification({
          userId: member.user_id,
          type: 'REVIEW_REQUESTED',
          message: `${req.user.name} created a code review: "${title.trim()}".`,
          relatedEntityType: 'REVIEW',
          relatedEntityId: reviewId
        });
      }
    }

    await logAuditEvent({
      actorId: req.user.id,
      action: 'REVIEW_CREATED',
      entityType: 'REVIEW',
      entityId: reviewId,
      details: { projectId, title }
    });

    res.status(201).json({
      message: 'Review created successfully',
      review
    });
  } catch (err) {
    next(err);
  }
}

async function listProjectReviews(req, res, next) {
  try {
    const { projectId } = req.params;

    const result = await db.query(
      `SELECT r.*, u.name as author_name, u.avatar_url as author_avatar,
              (SELECT COUNT(*) FROM review_comments rc WHERE rc.review_id = r.id) as comment_count
       FROM reviews r
       JOIN users u ON r.author_id = u.id
       WHERE r.project_id = $1
       ORDER BY r.created_at DESC`,
      [projectId]
    );

    res.json({ reviews: result.rows });
  } catch (err) {
    next(err);
  }
}

async function getReviewDetails(req, res, next) {
  try {
    const { reviewId } = req.params;

    const reviewRes = await db.query(
      `SELECT r.*, u.name as author_name, u.avatar_url as author_avatar, p.title as project_title
       FROM reviews r
       JOIN users u ON r.author_id = u.id
       JOIN projects p ON r.project_id = p.id
       WHERE r.id = $1`,
      [reviewId]
    );

    if (reviewRes.rows.length === 0) {
      return res.status(404).json({
        error: { code: 'REVIEW_NOT_FOUND', message: 'Review not found.' }
      });
    }

    const review = reviewRes.rows[0];

    // Fetch comments and suggestions
    const commentsRes = await db.query(
      `SELECT rc.*, u.name as author_name, u.avatar_url as author_avatar
       FROM review_comments rc
       JOIN users u ON rc.author_id = u.id
       WHERE rc.review_id = $1
       ORDER BY rc.created_at ASC`,
      [reviewId]
    );

    review.comments = commentsRes.rows;

    res.json({ review });
  } catch (err) {
    next(err);
  }
}

async function addReviewComment(req, res, next) {
  try {
    const { reviewId } = req.params;
    const { file_path, line_number = null, body, suggestion = '' } = req.body;

    if (!file_path || !body || !body.trim()) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'File path and comment body are required.' }
      });
    }

    const reviewRes = await db.query('SELECT * FROM reviews WHERE id = $1', [reviewId]);
    if (reviewRes.rows.length === 0) {
      return res.status(404).json({
        error: { code: 'REVIEW_NOT_FOUND', message: 'Review not found.' }
      });
    }

    const review = reviewRes.rows[0];
    const commentId = uuidv4();

    const result = await db.query(
      `INSERT INTO review_comments (id, review_id, author_id, file_path, line_number, body, suggestion, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'open', CURRENT_TIMESTAMP)
       RETURNING *`,
      [commentId, reviewId, req.user.id, file_path, line_number, body.trim(), suggestion.trim()]
    );

    const comment = result.rows[0];
    comment.author_name = req.user.name;
    comment.author_avatar = req.user.avatar_url;

    // Notify review author if different
    if (review.author_id !== req.user.id) {
      await createNotification({
        userId: review.author_id,
        type: 'REVIEW_COMMENT',
        message: `${req.user.name} commented on your review: "${body.slice(0, 80)}"`,
        relatedEntityType: 'REVIEW',
        relatedEntityId: reviewId
      });
    }

    res.status(201).json({
      message: 'Comment added successfully',
      comment
    });
  } catch (err) {
    next(err);
  }
}

async function updateCommentStatus(req, res, next) {
  try {
    const { commentId } = req.params;
    const { status } = req.body; // 'open', 'resolved', 'accepted', 'rejected'

    if (!['open', 'resolved', 'accepted', 'rejected'].includes(status)) {
      return res.status(400).json({
        error: { code: 'INVALID_STATUS', message: 'Status must be open, resolved, accepted, or rejected.' }
      });
    }

    const updateRes = await db.query(
      `UPDATE review_comments
       SET status = $1
       WHERE id = $2
       RETURNING *`,
      [status, commentId]
    );

    if (updateRes.rows.length === 0) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Review comment not found.' }
      });
    }

    res.json({
      message: `Comment status updated to ${status}`,
      comment: updateRes.rows[0]
    });
  } catch (err) {
    next(err);
  }
}

async function updateReviewDecision(req, res, next) {
  try {
    const { reviewId } = req.params;
    const { status } = req.body; // 'pending', 'changes_requested', 'approved'

    if (!['pending', 'changes_requested', 'approved'].includes(status)) {
      return res.status(400).json({
        error: { code: 'INVALID_STATUS', message: 'Status must be pending, changes_requested, or approved.' }
      });
    }

    const reviewRes = await db.query('SELECT * FROM reviews WHERE id = $1', [reviewId]);
    if (reviewRes.rows.length === 0) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Review not found.' }
      });
    }

    const review = reviewRes.rows[0];

    const updateRes = await db.query(
      `UPDATE reviews
       SET status = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [status, reviewId]
    );

    // Notify review author
    await createNotification({
      userId: review.author_id,
      type: 'REVIEW_DECISION',
      message: `${req.user.name} marked review "${review.title}" as ${status.replace('_', ' ')}.`,
      relatedEntityType: 'REVIEW',
      relatedEntityId: reviewId
    });

    await logAuditEvent({
      actorId: req.user.id,
      action: `REVIEW_${status.toUpperCase()}`,
      entityType: 'REVIEW',
      entityId: reviewId,
      details: { reviewer: req.user.name, decision: status }
    });

    res.json({
      message: `Review decision recorded: ${status}`,
      review: updateRes.rows[0]
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createReview,
  listProjectReviews,
  getReviewDetails,
  addReviewComment,
  updateCommentStatus,
  updateReviewDecision
};
