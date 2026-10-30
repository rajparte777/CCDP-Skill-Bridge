const jwt = require('jsonwebtoken');
const env = require('../config/env');
const db = require('../config/db');

async function authenticate(req, res, next) {
  let decoded;
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication token required.'
        }
      });
    }

    const token = authHeader.split(' ')[1];
    if (!token || token === 'null' || token === 'undefined' || token.trim() === '') {
      return res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication token required.'
        }
      });
    }

    decoded = jwt.verify(token, env.JWT_SECRET);
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: {
          code: 'TOKEN_EXPIRED',
          message: 'Your session has expired. Please log in again.'
        }
      });
    }
    return res.status(401).json({
      error: {
        code: 'INVALID_TOKEN',
        message: 'Invalid authorization token.'
      }
    });
  }

  try {
    let userRes = await db.query(
      'SELECT id, name, email, bio, avatar_url, github_username, portfolio_url, role, is_public, github_access_token FROM users WHERE id = $1',
      [decoded.userId]
    );

    // If not found in primary store, check SQLite fallback instance if active
    if (userRes.rows.length === 0 && db.getSqliteInstance) {
      try {
        const sqDb = db.getSqliteInstance();
        if (sqDb) {
          const sqUser = sqDb.prepare(
            'SELECT id, name, email, bio, avatar_url, github_username, portfolio_url, role, is_public, github_access_token FROM users WHERE id = ?'
          ).get(decoded.userId);
          if (sqUser) {
            userRes = { rows: [sqUser] };
          }
        }
      } catch (sqErr) {
        // Fallback check error ignored
      }
    }

    if (userRes.rows.length === 0) {
      return res.status(401).json({
        error: {
          code: 'USER_NOT_FOUND',
          message: 'The user account associated with this token no longer exists.'
        }
      });
    }

    req.user = userRes.rows[0];
    next();
  } catch (dbErr) {
    console.error('[auth] Database error in authenticate:', dbErr);
    next(dbErr);
  }
}

async function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, env.JWT_SECRET);
      const userRes = await db.query(
        'SELECT id, name, email, bio, avatar_url, github_username, portfolio_url, role, is_public, github_access_token FROM users WHERE id = $1',
        [decoded.userId]
      );
      if (userRes.rows.length > 0) {
        req.user = userRes.rows[0];
      }
    }
  } catch (err) {
    // Ignore invalid tokens in optional auth
  }
  next();
}

/**
 * Middleware to check project membership & role
 * @param {Array<string>} allowedRoles e.g. ['owner', 'contributor', 'reviewer']
 */
function requireProjectRole(allowedRoles = ['owner', 'contributor', 'reviewer', 'viewer']) {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          error: { code: 'UNAUTHORIZED', message: 'Authentication required.' }
        });
      }

      const projectId = req.params.projectId || req.body.project_id || req.query.projectId;
      if (!projectId) {
        return res.status(400).json({
          error: { code: 'VALIDATION_ERROR', message: 'Project ID is required.' }
        });
      }

      // Check if project exists
      const projectRes = await db.query('SELECT * FROM projects WHERE id = $1', [projectId]);
      if (projectRes.rows.length === 0) {
        return res.status(404).json({
          error: { code: 'PROJECT_NOT_FOUND', message: 'Project not found.' }
        });
      }

      const project = projectRes.rows[0];
      req.project = project;

      // Project owner has all rights
      if (project.owner_id === req.user.id) {
        req.projectRole = 'owner';
        return next();
      }

      // Check membership
      const memberRes = await db.query(
        'SELECT role FROM project_members WHERE project_id = $1 AND user_id = $2',
        [projectId, req.user.id]
      );

      if (memberRes.rows.length === 0) {
        // If public project and read-only action, allow as viewer if viewer is in allowedRoles
        if (project.visibility === 'public' && allowedRoles.includes('viewer') && req.method === 'GET') {
          req.projectRole = 'viewer';
          return next();
        }

        return res.status(403).json({
          error: { code: 'FORBIDDEN', message: 'You are not a member of this project.' }
        });
      }

      const memberRole = memberRes.rows[0].role;
      req.projectRole = memberRole;

      if (!allowedRoles.includes(memberRole)) {
        return res.status(403).json({
          error: {
            code: 'INSUFFICIENT_PERMISSIONS',
            message: `Role '${memberRole}' lacks permissions for this action. Required: ${allowedRoles.join(', ')}`
          }
        });
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}

module.exports = {
  authenticate,
  optionalAuth,
  requireProjectRole
};
