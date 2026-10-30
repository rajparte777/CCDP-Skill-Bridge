const { v4: uuidv4 } = require('uuid');
const db = require('../../config/db');
const { createNotification } = require('../notifications/notificationService');
const { logAuditEvent } = require('../audit/auditService');

async function sendConnectionRequest(req, res, next) {
  try {
    const requesterId = req.user.id;
    const { receiverId } = req.body;

    if (!receiverId) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Target user receiverId is required.' }
      });
    }

    if (requesterId === receiverId) {
      return res.status(400).json({
        error: { code: 'SELF_CONNECTION', message: 'You cannot connect with yourself.' }
      });
    }

    // Check receiver exists
    const receiverRes = await db.query('SELECT id, name FROM users WHERE id = $1', [receiverId]);
    if (receiverRes.rows.length === 0) {
      return res.status(404).json({
        error: { code: 'USER_NOT_FOUND', message: 'Target user does not exist.' }
      });
    }

    // Check if duplicate or existing active connection exists
    const existing = await db.query(
      `SELECT * FROM connections
       WHERE (requester_id = $1 AND receiver_id = $2)
          OR (requester_id = $2 AND receiver_id = $1)`,
      [requesterId, receiverId]
    );

    if (existing.rows.length > 0) {
      const conn = existing.rows[0];
      if (conn.status === 'accepted') {
        return res.status(409).json({
          error: { code: 'ALREADY_CONNECTED', message: 'You are already connected with this developer.' }
        });
      }
      if (conn.status === 'pending') {
        return res.status(409).json({
          error: { code: 'REQUEST_PENDING', message: 'A connection request between you is already pending.' }
        });
      }
    }

    const connectionId = uuidv4();
    const result = await db.query(
      `INSERT INTO connections (id, requester_id, receiver_id, status, created_at, updated_at)
       VALUES ($1, $2, $3, 'pending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING *`,
      [connectionId, requesterId, receiverId]
    );

    // Notify receiver
    await createNotification({
      userId: receiverId,
      type: 'CONNECTION_REQUEST',
      message: `${req.user.name} sent you a connection request.`,
      relatedEntityType: 'CONNECTION',
      relatedEntityId: connectionId
    });

    await logAuditEvent({
      actorId: requesterId,
      action: 'CONNECTION_REQUEST_SENT',
      entityType: 'CONNECTION',
      entityId: connectionId,
      details: { receiverId }
    });

    res.status(201).json({
      message: 'Connection request sent successfully',
      connection: result.rows[0]
    });
  } catch (err) {
    next(err);
  }
}

async function respondToConnectionRequest(req, res, next) {
  try {
    const { connectionId } = req.params;
    const { action } = req.body; // 'accepted' or 'rejected'
    const userId = req.user.id;

    if (!['accepted', 'rejected'].includes(action)) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: "Action must be 'accepted' or 'rejected'." }
      });
    }

    const connRes = await db.query('SELECT * FROM connections WHERE id = $1', [connectionId]);
    if (connRes.rows.length === 0) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Connection request not found.' }
      });
    }

    const conn = connRes.rows[0];

    // Only the receiver can accept/reject
    if (conn.receiver_id !== userId) {
      return res.status(403).json({
        error: { code: 'FORBIDDEN', message: 'Only the recipient can respond to this connection request.' }
      });
    }

    if (conn.status !== 'pending') {
      return res.status(409).json({
        error: { code: 'ALREADY_PROCESSED', message: `This connection request is already ${conn.status}.` }
      });
    }

    const updateRes = await db.query(
      `UPDATE connections
       SET status = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [action, connectionId]
    );

    // Notify requester
    await createNotification({
      userId: conn.requester_id,
      type: action === 'accepted' ? 'CONNECTION_ACCEPTED' : 'CONNECTION_REJECTED',
      message: `${req.user.name} ${action} your connection request.`,
      relatedEntityType: 'CONNECTION',
      relatedEntityId: connectionId
    });

    await logAuditEvent({
      actorId: userId,
      action: `CONNECTION_${action.toUpperCase()}`,
      entityType: 'CONNECTION',
      entityId: connectionId
    });

    res.json({
      message: `Connection request ${action}`,
      connection: updateRes.rows[0]
    });
  } catch (err) {
    next(err);
  }
}

async function listMyConnections(req, res, next) {
  try {
    const userId = req.user.id;

    // Accepted connections
    const acceptedRes = await db.query(
      `SELECT c.id as connection_id, c.created_at as connected_since,
              u.id as user_id, u.name, u.email, u.bio, u.avatar_url, u.github_username
       FROM connections c
       JOIN users u ON (CASE WHEN c.requester_id = $1 THEN c.receiver_id ELSE c.requester_id END) = u.id
       WHERE (c.requester_id = $1 OR c.receiver_id = $1) AND c.status = 'accepted'
       ORDER BY c.updated_at DESC`,
      [userId]
    );

    // Pending received
    const pendingReceivedRes = await db.query(
      `SELECT c.id as connection_id, c.created_at,
              u.id as user_id, u.name, u.email, u.bio, u.avatar_url, u.github_username
       FROM connections c
       JOIN users u ON c.requester_id = u.id
       WHERE c.receiver_id = $1 AND c.status = 'pending'
       ORDER BY c.created_at DESC`,
      [userId]
    );

    // Pending sent
    const pendingSentRes = await db.query(
      `SELECT c.id as connection_id, c.created_at,
              u.id as user_id, u.name, u.email, u.bio, u.avatar_url, u.github_username
       FROM connections c
       JOIN users u ON c.receiver_id = u.id
       WHERE c.requester_id = $1 AND c.status = 'pending'
       ORDER BY c.created_at DESC`,
      [userId]
    );

    res.json({
      connections: acceptedRes.rows,
      pendingReceived: pendingReceivedRes.rows,
      pendingSent: pendingSentRes.rows
    });
  } catch (err) {
    next(err);
  }
}

async function removeConnection(req, res, next) {
  try {
    const { connectionId } = req.params;
    const userId = req.user.id;

    const connRes = await db.query('SELECT * FROM connections WHERE id = $1', [connectionId]);
    if (connRes.rows.length === 0) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Connection record not found.' }
      });
    }

    const conn = connRes.rows[0];
    if (conn.requester_id !== userId && conn.receiver_id !== userId) {
      return res.status(403).json({
        error: { code: 'FORBIDDEN', message: 'You are not a party to this connection.' }
      });
    }

    await db.query('DELETE FROM connections WHERE id = $1', [connectionId]);

    res.json({ message: 'Connection removed successfully' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  sendConnectionRequest,
  respondToConnectionRequest,
  listMyConnections,
  removeConnection
};
