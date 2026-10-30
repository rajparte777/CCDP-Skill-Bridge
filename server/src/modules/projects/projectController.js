const { v4: uuidv4 } = require('uuid');
const db = require('../../config/db');
const { createNotification } = require('../notifications/notificationService');
const { logAuditEvent } = require('../audit/auditService');

async function createProject(req, res, next) {
  try {
    const ownerId = req.user.id;
    const {
      title,
      description = '',
      visibility = 'public',
      collaboration_type = 'free',
      technologies = [],
      repository_url = ''
    } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Project title is required.' }
      });
    }

    const projectId = uuidv4();
    const techJson = typeof technologies === 'string' ? technologies : JSON.stringify(technologies);

    const projectRes = await db.query(
      `INSERT INTO projects (id, owner_id, title, description, visibility, collaboration_type, status, technologies, repository_url, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'active', $7, $8, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING *`,
      [projectId, ownerId, title.trim(), description, visibility, collaboration_type, techJson, repository_url]
    );

    const project = projectRes.rows[0];

    // Add owner to project_members with role 'owner'
    const memberId = uuidv4();
    await db.query(
      `INSERT INTO project_members (id, project_id, user_id, role, joined_at)
       VALUES ($1, $2, $3, 'owner', CURRENT_TIMESTAMP)`,
      [memberId, projectId, ownerId]
    );

    // Create a default initial document (README.md or main.js)
    const docId = uuidv4();
    const defaultContent = `# ${title}\n\n${description || 'Welcome to the project workspace!'}\n\n## Tech Stack\n${Array.isArray(technologies) ? technologies.map(t => `- ${t}`).join('\n') : ''}\n`;
    await db.query(
      `INSERT INTO editor_documents (id, project_id, file_path, content, language, updated_by, created_at, updated_at)
       VALUES ($1, $2, 'README.md', $3, 'markdown', $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [docId, projectId, defaultContent, ownerId]
    );

    await logAuditEvent({
      actorId: ownerId,
      action: 'PROJECT_CREATED',
      entityType: 'PROJECT',
      entityId: projectId,
      details: { title, visibility, collaboration_type }
    });

    res.status(201).json({
      message: 'Project created successfully',
      project
    });
  } catch (err) {
    next(err);
  }
}

async function listProjects(req, res, next) {
  try {
    const { search = '', technology = '', collaboration_type = '', visibility = '', page = 1, limit = 20 } = req.query;
    const userId = req.user ? req.user.id : null;
    const offset = (page - 1) * limit;

    let sql = `
      SELECT p.*, u.name as owner_name, u.avatar_url as owner_avatar,
             (SELECT COUNT(*) FROM project_members pm WHERE pm.project_id = p.id) as member_count
      FROM projects p
      JOIN users u ON p.owner_id = u.id
      WHERE (p.visibility = 'public' ${userId ? 'OR p.owner_id = $1 OR p.id IN (SELECT project_id FROM project_members WHERE user_id = $1)' : ''})
    `;
    const params = [];
    if (userId) {
      params.push(userId);
    }

    if (search.trim()) {
      params.push(`%${search.trim().toLowerCase()}%`);
      sql += ` AND (LOWER(p.title) LIKE $${params.length} OR LOWER(p.description) LIKE $${params.length})`;
    }

    if (collaboration_type && ['free', 'paid'].includes(collaboration_type)) {
      params.push(collaboration_type);
      sql += ` AND p.collaboration_type = $${params.length}`;
    }

    if (technology.trim()) {
      params.push(`%${technology.trim().toLowerCase()}%`);
      sql += ` AND LOWER(p.technologies) LIKE $${params.length}`;
    }

    sql += ` ORDER BY p.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(Number(limit), Number(offset));

    const result = await db.query(sql, params);

    // Parse technologies JSON
    const projects = result.rows.map(p => {
      try {
        p.technologies = typeof p.technologies === 'string' ? JSON.parse(p.technologies) : p.technologies;
      } catch (e) {
        p.technologies = [];
      }
      return p;
    });

    res.json({ projects });
  } catch (err) {
    next(err);
  }
}

async function getProjectById(req, res, next) {
  try {
    const { projectId } = req.params;
    const userId = req.user ? req.user.id : null;

    const projectRes = await db.query(
      `SELECT p.*, u.name as owner_name, u.email as owner_email, u.avatar_url as owner_avatar
       FROM projects p
       JOIN users u ON p.owner_id = u.id
       WHERE p.id = $1`,
      [projectId]
    );

    if (projectRes.rows.length === 0) {
      return res.status(404).json({
        error: { code: 'PROJECT_NOT_FOUND', message: 'Project not found.' }
      });
    }

    const project = projectRes.rows[0];

    // Privacy check (FR-05, BR-02)
    let userRole = null;
    let isMember = false;

    if (userId) {
      const memberRes = await db.query(
        'SELECT role FROM project_members WHERE project_id = $1 AND user_id = $2',
        [projectId, userId]
      );
      if (memberRes.rows.length > 0) {
        userRole = memberRes.rows[0].role;
        isMember = true;
      }
    }

    if (project.visibility === 'private' && !isMember && project.owner_id !== userId) {
      return res.status(403).json({
        error: { code: 'FORBIDDEN', message: 'You do not have permission to view this private project.' }
      });
    }

    try {
      project.technologies = typeof project.technologies === 'string' ? JSON.parse(project.technologies) : project.technologies;
    } catch (e) {
      project.technologies = [];
    }

    // Fetch members
    const membersRes = await db.query(
      `SELECT pm.id, pm.role, pm.joined_at, u.id as user_id, u.name, u.email, u.avatar_url, u.github_username
       FROM project_members pm
       JOIN users u ON pm.user_id = u.id
       WHERE pm.project_id = $1
       ORDER BY pm.joined_at ASC`,
      [projectId]
    );
    project.members = membersRes.rows;

    // Fetch linked GitHub repo if any
    const repoRes = await db.query('SELECT * FROM github_repositories WHERE project_id = $1', [projectId]);
    project.github = repoRes.rows.length > 0 ? repoRes.rows[0] : null;

    // Attach user's personal role on this project
    project.currentUserRole = project.owner_id === userId ? 'owner' : userRole;

    res.json({ project });
  } catch (err) {
    next(err);
  }
}

async function updateProject(req, res, next) {
  try {
    const { projectId } = req.params;
    const { title, description, visibility, collaboration_type, status, technologies, repository_url } = req.body;

    const project = req.project; // From requireProjectRole('owner')

    const updatedTitle = title !== undefined ? title.trim() : project.title;
    const updatedDesc = description !== undefined ? description : project.description;
    const updatedVis = visibility !== undefined ? visibility : project.visibility;
    const updatedCollab = collaboration_type !== undefined ? collaboration_type : project.collaboration_type;
    const updatedStatus = status !== undefined ? status : project.status;
    const updatedRepo = repository_url !== undefined ? repository_url : project.repository_url;
    const updatedTech = technologies !== undefined
      ? (typeof technologies === 'string' ? technologies : JSON.stringify(technologies))
      : project.technologies;

    const updateRes = await db.query(
      `UPDATE projects
       SET title = $1, description = $2, visibility = $3, collaboration_type = $4,
           status = $5, technologies = $6, repository_url = $7, updated_at = CURRENT_TIMESTAMP
       WHERE id = $8
       RETURNING *`,
      [updatedTitle, updatedDesc, updatedVis, updatedCollab, updatedStatus, updatedTech, updatedRepo, projectId]
    );

    await logAuditEvent({
      actorId: req.user.id,
      action: 'PROJECT_UPDATED',
      entityType: 'PROJECT',
      entityId: projectId
    });

    res.json({
      message: 'Project updated successfully',
      project: updateRes.rows[0]
    });
  } catch (err) {
    next(err);
  }
}

async function inviteMember(req, res, next) {
  try {
    const { projectId } = req.params;
    const { userId, role = 'contributor' } = req.body;

    if (!userId) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'User ID is required.' }
      });
    }

    if (!['contributor', 'reviewer', 'viewer'].includes(role)) {
      return res.status(400).json({
        error: { code: 'INVALID_ROLE', message: "Role must be 'contributor', 'reviewer', or 'viewer'." }
      });
    }

    // Check user exists
    const userRes = await db.query('SELECT id, name FROM users WHERE id = $1', [userId]);
    if (userRes.rows.length === 0) {
      return res.status(404).json({
        error: { code: 'USER_NOT_FOUND', message: 'User not found.' }
      });
    }

    // Check if already a member
    const existing = await db.query(
      'SELECT id, role FROM project_members WHERE project_id = $1 AND user_id = $2',
      [projectId, userId]
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({
        error: { code: 'ALREADY_MEMBER', message: 'User is already a member of this project.' }
      });
    }

    const memberId = uuidv4();
    const result = await db.query(
      `INSERT INTO project_members (id, project_id, user_id, role, joined_at)
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
       RETURNING *`,
      [memberId, projectId, userId, role]
    );

    await createNotification({
      userId,
      type: 'PROJECT_INVITATION',
      message: `You were added to project "${req.project.title}" as a ${role}.`,
      relatedEntityType: 'PROJECT',
      relatedEntityId: projectId
    });

    await logAuditEvent({
      actorId: req.user.id,
      action: 'PROJECT_MEMBER_ADDED',
      entityType: 'PROJECT',
      entityId: projectId,
      details: { memberUserId: userId, role }
    });

    res.status(201).json({
      message: 'Member added successfully',
      member: result.rows[0]
    });
  } catch (err) {
    next(err);
  }
}

async function updateMemberRole(req, res, next) {
  try {
    const { projectId, memberUserId } = req.params;
    const { role } = req.body;

    if (!['contributor', 'reviewer', 'viewer', 'owner'].includes(role)) {
      return res.status(400).json({
        error: { code: 'INVALID_ROLE', message: 'Invalid role specified.' }
      });
    }

    const updateRes = await db.query(
      `UPDATE project_members
       SET role = $1
       WHERE project_id = $2 AND user_id = $3
       RETURNING *`,
      [role, projectId, memberUserId]
    );

    if (updateRes.rows.length === 0) {
      return res.status(404).json({
        error: { code: 'MEMBER_NOT_FOUND', message: 'Member not found in project.' }
      });
    }

    await logAuditEvent({
      actorId: req.user.id,
      action: 'MEMBER_ROLE_UPDATED',
      entityType: 'PROJECT',
      entityId: projectId,
      details: { memberUserId, newRole: role }
    });

    res.json({
      message: 'Member role updated',
      member: updateRes.rows[0]
    });
  } catch (err) {
    next(err);
  }
}

async function removeMember(req, res, next) {
  try {
    const { projectId, memberUserId } = req.params;

    // Prevent removing the original project owner
    if (req.project.owner_id === memberUserId) {
      return res.status(400).json({
        error: { code: 'CANNOT_REMOVE_OWNER', message: 'Cannot remove the primary project owner.' }
      });
    }

    await db.query(
      'DELETE FROM project_members WHERE project_id = $1 AND user_id = $2',
      [projectId, memberUserId]
    );

    await logAuditEvent({
      actorId: req.user.id,
      action: 'PROJECT_MEMBER_REMOVED',
      entityType: 'PROJECT',
      entityId: projectId,
      details: { removedUserId: memberUserId }
    });

    res.json({ message: 'Member removed successfully' });
  } catch (err) {
    next(err);
  }
}

async function getActivityFeed(req, res, next) {
  try {
    // Collect public projects and projects where user is member
    const userId = req.user ? req.user.id : null;

    const eventsRes = await db.query(
      `SELECT e.id, e.event_type, e.payload_summary, e.occurred_at,
              r.name as repo_name, r.owner as repo_owner, p.id as project_id, p.title as project_title
       FROM repository_events e
       JOIN github_repositories r ON e.repository_id = r.id
       JOIN projects p ON r.project_id = p.id
       WHERE p.visibility = 'public' ${userId ? 'OR p.owner_id = $1 OR p.id IN (SELECT project_id FROM project_members WHERE user_id = $1)' : ''}
       ORDER BY e.occurred_at DESC
       LIMIT 30`,
      userId ? [userId] : []
    );

    const auditRes = await db.query(
      `SELECT a.id, a.action, a.entity_type, a.entity_id, a.details, a.created_at,
              u.name as actor_name, u.avatar_url as actor_avatar
       FROM audit_events a
       LEFT JOIN users u ON a.actor_id = u.id
       WHERE a.action IN ('PROJECT_CREATED', 'TASK_COMPLETED', 'REVIEW_APPROVED', 'OFFER_ACCEPTED')
       ORDER BY a.created_at DESC
       LIMIT 30`
    );

    // Merge and format feed
    const feed = [
      ...eventsRes.rows.map(e => ({
        id: e.id,
        type: 'GITHUB_EVENT',
        title: `${e.repo_name}: ${e.event_type}`,
        description: e.payload_summary,
        project_id: e.project_id,
        project_title: e.project_title,
        timestamp: e.occurred_at
      })),
      ...auditRes.rows.map(a => ({
        id: a.id,
        type: 'ACTIVITY_LOG',
        title: `${a.actor_name || 'System'} ${a.action.replace('_', ' ').toLowerCase()}`,
        description: a.details,
        project_id: a.entity_type === 'PROJECT' ? a.entity_id : null,
        timestamp: a.created_at,
        actor: { name: a.actor_name, avatar: a.actor_avatar }
      }))
    ].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 40);

    res.json({ feed });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createProject,
  listProjects,
  getProjectById,
  updateProject,
  inviteMember,
  updateMemberRole,
  removeMember,
  getActivityFeed
};
