const { v4: uuidv4 } = require('uuid');
const db = require('../../config/db');
const { logAuditEvent } = require('../audit/auditService');

async function getProfile(req, res, next) {
  try {
    const { userId } = req.params;
    const isOwner = req.user && req.user.id === userId;

    const userRes = await db.query(
      'SELECT id, name, email, bio, avatar_url, github_username, portfolio_url, role, is_public, created_at FROM users WHERE id = $1',
      [userId]
    );

    if (userRes.rows.length === 0) {
      return res.status(404).json({
        error: { code: 'USER_NOT_FOUND', message: 'User profile not found.' }
      });
    }

    const profile = userRes.rows[0];

    // Privacy check (FR-05)
    if (!profile.is_public && !isOwner) {
      return res.status(403).json({
        error: { code: 'PROFILE_PRIVATE', message: 'This developer profile is set to private.' }
      });
    }

    // Hide email for non-owners if needed, or provide if public
    if (!isOwner && !profile.is_public) {
      delete profile.email;
    }

    // Skills
    const skillsRes = await db.query(
      `SELECT s.id, s.name FROM skills s
       JOIN user_skills us ON s.id = us.skill_id
       WHERE us.user_id = $1`,
      [userId]
    );
    profile.skills = skillsRes.rows;

    // Public projects created by this user
    const projectsRes = await db.query(
      `SELECT id, title, description, visibility, collaboration_type, status, technologies, created_at
       FROM projects WHERE owner_id = $1 ${isOwner ? '' : "AND visibility = 'public'"}
       ORDER BY created_at DESC`,
      [userId]
    );
    profile.projects = projectsRes.rows;

    res.json({ profile });
  } catch (err) {
    next(err);
  }
}

async function updateProfile(req, res, next) {
  try {
    const userId = req.user.id;
    const { bio, avatar_url, github_username, portfolio_url, is_public, skills } = req.body;

    const existingRes = await db.query('SELECT * FROM users WHERE id = $1', [userId]);
    if (existingRes.rows.length === 0) {
      return res.status(404).json({
        error: { code: 'USER_NOT_FOUND', message: 'User not found.' }
      });
    }

    const current = existingRes.rows[0];

    const updatedBio = bio !== undefined ? bio : current.bio;
    const updatedAvatar = avatar_url !== undefined ? avatar_url : current.avatar_url;
    const updatedGithub = github_username !== undefined ? github_username : current.github_username;
    const updatedPortfolio = portfolio_url !== undefined ? portfolio_url : current.portfolio_url;
    const updatedVisibility = is_public !== undefined ? Boolean(is_public) : current.is_public;

    const updateRes = await db.query(
      `UPDATE users
       SET bio = $1, avatar_url = $2, github_username = $3, portfolio_url = $4, is_public = $5, updated_at = CURRENT_TIMESTAMP
       WHERE id = $6
       RETURNING id, name, email, bio, avatar_url, github_username, portfolio_url, role, is_public, updated_at`,
      [updatedBio, updatedAvatar, updatedGithub, updatedPortfolio, updatedVisibility, userId]
    );

    // Update skills if array provided
    if (Array.isArray(skills)) {
      await db.query('DELETE FROM user_skills WHERE user_id = $1', [userId]);
      for (const skillName of skills) {
        if (!skillName || !skillName.trim()) continue;
        const clean = skillName.trim();
        let sRes = await db.query('SELECT id FROM skills WHERE LOWER(name) = LOWER($1)', [clean]);
        let skillId;
        if (sRes.rows.length === 0) {
          skillId = uuidv4();
          await db.query('INSERT INTO skills (id, name) VALUES ($1, $2)', [skillId, clean]);
        } else {
          skillId = sRes.rows[0].id;
        }
        await db.query('INSERT INTO user_skills (user_id, skill_id) VALUES ($1, $2)', [userId, skillId]);
      }
    }

    const skillsRes = await db.query(
      `SELECT s.id, s.name FROM skills s
       JOIN user_skills us ON s.id = us.skill_id
       WHERE us.user_id = $1`,
      [userId]
    );

    const updatedUser = updateRes.rows[0];
    updatedUser.skills = skillsRes.rows;

    await logAuditEvent({
      actorId: userId,
      action: 'PROFILE_UPDATED',
      entityType: 'USER',
      entityId: userId
    });

    res.json({
      message: 'Profile updated successfully',
      user: updatedUser
    });
  } catch (err) {
    next(err);
  }
}

async function listUsers(req, res, next) {
  try {
    const { search = '', skill = '', page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let sql = `
      SELECT DISTINCT u.id, u.name, u.email, u.bio, u.avatar_url, u.github_username, u.is_public, u.created_at
      FROM users u
      LEFT JOIN user_skills us ON u.id = us.user_id
      LEFT JOIN skills s ON us.skill_id = s.id
      WHERE u.is_public = TRUE
    `;
    const params = [];

    if (search.trim()) {
      params.push(`%${search.trim().toLowerCase()}%`);
      sql += ` AND (LOWER(u.name) LIKE $${params.length} OR LOWER(u.bio) LIKE $${params.length})`;
    }

    if (skill.trim()) {
      params.push(`%${skill.trim().toLowerCase()}%`);
      sql += ` AND LOWER(s.name) LIKE $${params.length}`;
    }

    sql += ` ORDER BY u.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(Number(limit), Number(offset));

    const usersRes = await db.query(sql, params);

    // Attach skills
    for (const u of usersRes.rows) {
      const sRes = await db.query(
        `SELECT s.id, s.name FROM skills s JOIN user_skills us ON s.id = us.skill_id WHERE us.user_id = $1`,
        [u.id]
      );
      u.skills = sRes.rows;
    }

    res.json({ users: usersRes.rows });
  } catch (err) {
    next(err);
  }
}

async function getAllSkills(req, res, next) {
  try {
    const skillsRes = await db.query('SELECT * FROM skills ORDER BY name ASC');
    res.json({ skills: skillsRes.rows });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getProfile,
  updateProfile,
  listUsers,
  getAllSkills
};
