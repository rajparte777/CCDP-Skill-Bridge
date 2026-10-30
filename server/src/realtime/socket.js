const jwt = require('jsonwebtoken');
const env = require('../config/env');
const db = require('../config/db');

// In-memory active presence maps
// documentId -> Map(socketId -> { userId, userName, avatarUrl, cursor })
const docPresence = new Map();
// projectId -> Set(userId)
const projectPresence = new Map();
// Debounce save timer map: documentId -> timeout
const saveTimers = new Map();

function setupSocketIO(io) {
  // Authentication middleware for Socket.IO
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth && socket.handshake.auth.token;
      if (!token) {
        return next(new Error('AUTH_REQUIRED'));
      }

      const decoded = jwt.verify(token, env.JWT_SECRET);
      const userRes = await db.query('SELECT id, name, email, avatar_url FROM users WHERE id = $1', [decoded.userId]);

      if (userRes.rows.length === 0) {
        return next(new Error('USER_NOT_FOUND'));
      }

      socket.user = userRes.rows[0];
      next();
    } catch (err) {
      next(new Error('INVALID_TOKEN'));
    }
  });

  io.on('connection', (socket) => {
    const user = socket.user;
    // Join personal notification channel
    socket.join(`user_${user.id}`);

    /**
     * Join Project Room & Track Presence
     */
    socket.on('project:join', async ({ projectId }) => {
      try {
        if (!projectId) return;

        // Verify project membership / public access
        const projRes = await db.query('SELECT visibility, owner_id FROM projects WHERE id = $1', [projectId]);
        if (projRes.rows.length === 0) return;

        const project = projRes.rows[0];
        const memberRes = await db.query(
          'SELECT role FROM project_members WHERE project_id = $1 AND user_id = $2',
          [projectId, user.id]
        );

        const isOwner = project.owner_id === user.id;
        const isMember = memberRes.rows.length > 0;
        const isPublic = project.visibility === 'public';

        if (!isOwner && !isMember && !isPublic) {
          socket.emit('error', { message: 'Unauthorized project room access' });
          return;
        }

        const room = `project_${projectId}`;
        socket.join(room);

        if (!projectPresence.has(projectId)) {
          projectPresence.set(projectId, new Set());
        }
        projectPresence.get(projectId).add(user.id);

        io.to(room).emit('project:presence', {
          projectId,
          activeUserIds: Array.from(projectPresence.get(projectId))
        });
      } catch (err) {
        console.error('[Socket] project:join error:', err);
      }
    });

    socket.on('project:leave', ({ projectId }) => {
      if (!projectId) return;
      const room = `project_${projectId}`;
      socket.leave(room);
      if (projectPresence.has(projectId)) {
        projectPresence.get(projectId).delete(user.id);
        io.to(room).emit('project:presence', {
          projectId,
          activeUserIds: Array.from(projectPresence.get(projectId))
        });
      }
    });

    /**
     * Join Document Collaboration Session (FR-21, FR-22, FR-23, FR-25)
     */
    socket.on('doc:join', async ({ projectId, documentId }) => {
      try {
        if (!projectId || !documentId) return;

        // Verify edit authorization (FR-25)
        const memberRes = await db.query(
          'SELECT role FROM project_members WHERE project_id = $1 AND user_id = $2',
          [projectId, user.id]
        );
        const projRes = await db.query('SELECT owner_id, visibility FROM projects WHERE id = $1', [projectId]);

        if (projRes.rows.length === 0) return;
        const project = projRes.rows[0];
        const isOwner = project.owner_id === user.id;
        const role = isOwner ? 'owner' : (memberRes.rows.length > 0 ? memberRes.rows[0].role : null);

        if (!role && project.visibility !== 'public') {
          socket.emit('doc:error', { message: 'Unauthorized to view this document.' });
          return;
        }

        const docRoom = `doc_${documentId}`;
        socket.join(docRoom);

        // Fetch persisted content from DB
        const docRes = await db.query('SELECT * FROM editor_documents WHERE id = $1 AND project_id = $2', [documentId, projectId]);
        if (docRes.rows.length === 0) {
          socket.emit('doc:error', { message: 'Document not found.' });
          return;
        }

        const doc = docRes.rows[0];

        // Track presence
        if (!docPresence.has(documentId)) {
          docPresence.set(documentId, new Map());
        }
        const roomUsers = docPresence.get(documentId);
        roomUsers.set(socket.id, {
          userId: user.id,
          userName: user.name,
          avatarUrl: user.avatar_url,
          role: role || 'viewer',
          cursor: null
        });

        // Send initial document state to joining client
        socket.emit('doc:init', {
          documentId,
          content: doc.content || '',
          language: doc.language || 'javascript',
          filePath: doc.file_path,
          role: role || 'viewer'
        });

        // Broadcast presence update
        io.to(docRoom).emit('doc:presence', {
          documentId,
          collaborators: Array.from(roomUsers.values())
        });
      } catch (err) {
        console.error('[Socket] doc:join error:', err);
      }
    });

    /**
     * Broadcast live edit to connected peers & debounce save to DB (FR-22, FR-24)
     */
    socket.on('doc:edit', async ({ projectId, documentId, content, delta }) => {
      try {
        if (!projectId || !documentId) return;

        // Verify user is not a viewer
        const roomUsers = docPresence.get(documentId);
        const userInfo = roomUsers ? roomUsers.get(socket.id) : null;
        if (userInfo && userInfo.role === 'viewer') {
          socket.emit('doc:error', { message: 'Read-only viewer cannot make edits.' });
          return;
        }

        const docRoom = `doc_${documentId}`;

        // Broadcast changes to other collaborators in real time (target < 500ms as per NFR-05)
        socket.to(docRoom).emit('doc:change', {
          documentId,
          content,
          delta,
          sender: { id: user.id, name: user.name }
        });

        // Debounced persistence to PostgreSQL / SQLite (FR-24)
        if (saveTimers.has(documentId)) {
          clearTimeout(saveTimers.get(documentId));
        }

        const timer = setTimeout(async () => {
          try {
            await db.query(
              'UPDATE editor_documents SET content = $1, updated_by = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3',
              [content, user.id, documentId]
            );
            saveTimers.delete(documentId);
            io.to(docRoom).emit('doc:saved', { documentId, savedAt: new Date().toISOString() });
          } catch (e) {
            console.error('[Socket] Auto-save error:', e.message);
          }
        }, 800);

        saveTimers.set(documentId, timer);
      } catch (err) {
        console.error('[Socket] doc:edit error:', err);
      }
    });

    /**
     * Cursor & selection awareness (FR-23)
     */
    socket.on('doc:cursor', ({ documentId, cursor }) => {
      if (!documentId) return;
      const roomUsers = docPresence.get(documentId);
      if (roomUsers && roomUsers.has(socket.id)) {
        roomUsers.get(socket.id).cursor = cursor;
        socket.to(`doc_${documentId}`).emit('doc:cursor_update', {
          documentId,
          userId: user.id,
          userName: user.name,
          cursor
        });
      }
    });

    /**
     * Leave Document Session
     */
    socket.on('doc:leave', ({ documentId }) => {
      if (!documentId) return;
      socket.leave(`doc_${documentId}`);
      const roomUsers = docPresence.get(documentId);
      if (roomUsers) {
        roomUsers.delete(socket.id);
        io.to(`doc_${documentId}`).emit('doc:presence', {
          documentId,
          collaborators: Array.from(roomUsers.values())
        });
      }
    });

    /**
     * Clean up on disconnect
     */
    socket.on('disconnect', () => {
      // Remove from document presence
      for (const [docId, roomUsers] of docPresence.entries()) {
        if (roomUsers.has(socket.id)) {
          roomUsers.delete(socket.id);
          io.to(`doc_${docId}`).emit('doc:presence', {
            documentId: docId,
            collaborators: Array.from(roomUsers.values())
          });
        }
      }

      // Remove from project presence
      for (const [projId, userSet] of projectPresence.entries()) {
        if (userSet.has(user.id)) {
          userSet.delete(user.id);
          io.to(`project_${projId}`).emit('project:presence', {
            projectId: projId,
            activeUserIds: Array.from(userSet)
          });
        }
      }
    });
  });
}

module.exports = {
  setupSocketIO
};
