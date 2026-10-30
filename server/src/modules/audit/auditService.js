const { v4: uuidv4 } = require('uuid');
const db = require('../../config/db');

async function logAuditEvent({ actorId, action, entityType, entityId, details = {} }) {
  try {
    const id = uuidv4();
    const detailsJson = typeof details === 'string' ? details : JSON.stringify(details);
    await db.query(
      `INSERT INTO audit_events (id, actor_id, action, entity_type, entity_id, details, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)`,
      [id, actorId, action, entityType, entityId, detailsJson]
    );
  } catch (err) {
    console.error('[AuditService] Failed to record audit log:', err.message);
  }
}

async function getRecentAuditEvents(limit = 50) {
  const res = await db.query(
    `SELECT a.*, u.name as actor_name, u.email as actor_email
     FROM audit_events a
     LEFT JOIN users u ON a.actor_id = u.id
     ORDER BY a.created_at DESC
     LIMIT $1`,
    [limit]
  );
  return res.rows;
}

module.exports = {
  logAuditEvent,
  getRecentAuditEvents
};
