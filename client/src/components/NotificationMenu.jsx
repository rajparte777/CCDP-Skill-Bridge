import React from 'react';
import { Check, Bell, ExternalLink } from 'lucide-react';
import { api } from '../services/api';

export default function NotificationMenu({ notifications, onNotificationUpdated, onClose, onSelectEntity }) {
  async function handleMarkAllAsRead() {
    try {
      await api.put('/notifications/read-all', {});
      onNotificationUpdated();
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  }

  async function handleMarkSingle(notif) {
    if (!notif.is_read) {
      try {
        await api.put(`/notifications/${notif.id}/read`, {});
        onNotificationUpdated();
      } catch (err) {
        console.error('Failed to mark as read:', err);
      }
    }
    if (onSelectEntity && notif.related_entity_type) {
      onSelectEntity(notif.related_entity_type, notif.related_entity_id);
      onClose();
    }
  }

  return (
    <div className="notif-menu">
      <div style={{
        padding: '12px 14px',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: '#161b22'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, fontSize: '0.9rem' }}>
          <Bell size={16} /> Notifications
        </div>
        {notifications.some(n => !n.is_read) && (
          <button
            onClick={handleMarkAllAsRead}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--accent-blue)',
              fontSize: '0.75rem',
              cursor: 'pointer'
            }}
          >
            Mark all read
          </button>
        )}
      </div>

      <div style={{ overflowY: 'auto', flex: 1 }}>
        {notifications.length === 0 ? (
          <div style={{ padding: '30px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            No notifications yet
          </div>
        ) : (
          notifications.map((n) => (
            <div
              key={n.id}
              className={`notif-item ${!n.is_read ? 'unread' : ''}`}
              onClick={() => handleMarkSingle(n)}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                  {n.type.replace('_', ' ')}
                </span>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                  {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-main)', lineHeight: 1.4 }}>
                {n.message}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
