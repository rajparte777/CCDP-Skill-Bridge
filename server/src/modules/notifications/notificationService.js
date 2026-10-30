const { v4: uuidv4 } = require('uuid');
const db = require('../../config/db');
let ioInstance = null;

function setSocketIO(io) {
  ioInstance = io;
}

async function createNotification({ userId, type, message, relatedEntityType = '', relatedEntityId = '' }) {
  try {
    const id = uuidv4();
    const res = await db.query(
      `INSERT INTO notifications (id, user_id, type, message, related_entity_type, related_entity_id, is_read, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, FALSE, CURRENT_TIMESTAMP)
       RETURNING *`,
      [id, userId, type, message, relatedEntityType, relatedEntityId]
    );

    const notification = res.rows[0];

    // Emit live event over Socket.IO if user is connected
    if (ioInstance) {
      ioInstance.to(`user_${userId}`).emit('notification', notification);
    }

    return notification;
  } catch (err) {
    console.error('[NotificationService] Error creating notification:', err);
    return null;
  }
}

async function getUserNotifications(userId) {
  const res = await db.query(
    'SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50',
    [userId]
  );
  return res.rows;
}

async function markAsRead(notificationId, userId) {
  await db.query(
    'UPDATE notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2',
    [notificationId, userId]
  );
}

async function markAllAsRead(userId) {
  await db.query(
    'UPDATE notifications SET is_read = TRUE WHERE user_id = $1',
    [userId]
  );
}

module.exports = {
  setSocketIO,
  createNotification,
  getUserNotifications,
  markAsRead,
  markAllAsRead
};
