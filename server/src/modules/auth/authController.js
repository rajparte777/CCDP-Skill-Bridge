const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const db = require('../../config/db');
const env = require('../../config/env');
const { logAuditEvent } = require('../audit/auditService');

function generateToken(userId) {
  return jwt.sign({ userId }, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN });
}

function validateEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email.trim());
}

function validatePasswordStrength(password) {
  if (!password || typeof password !== 'string') {
    return { valid: false, message: 'Password is required.' };
  }
  if (password.length < 8) {
    return { valid: false, message: 'Password must be at least 8 characters long.' };
  }
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  if (!hasLetter || !hasNumber) {
    return { valid: false, message: 'Password must contain both letters and numbers.' };
  }
  return { valid: true };
}

/**
 * Register a new user with email and secure password (FR-01, FR-03, NFR-01)
 */
async function register(req, res, next) {
  try {
    const { name, email, password, bio = '', skills = [], github_username = '', portfolio_url = '' } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Full name is required.' }
      });
    }

    if (!email || !validateEmail(email)) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Please provide a valid email address.' }
      });
    }

    const passwordValidation = validatePasswordStrength(password);
    if (!passwordValidation.valid) {
      return res.status(400).json({
        error: { code: 'WEAK_PASSWORD', message: passwordValidation.message }
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Check if user already exists
    const existing = await db.query('SELECT id FROM users WHERE email = $1', [normalizedEmail]);
    if (existing.rows.length > 0) {
      return res.status(409).json({
        error: { code: 'USER_EXISTS', message: 'An account with this email address already exists.' }
      });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    const userId = uuidv4();

    const avatarUrl = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(normalizedEmail)}`;

    const result = await db.query(
      `INSERT INTO users (id, name, email, password_hash, bio, avatar_url, github_username, portfolio_url, role, is_public, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'user', TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING id, name, email, bio, avatar_url, github_username, portfolio_url, role, is_public, created_at`,
      [userId, name.trim(), normalizedEmail, passwordHash, bio.trim(), avatarUrl, github_username.trim(), portfolio_url.trim()]
    );

    const user = result.rows[0];

    // Handle skills if provided
    if (Array.isArray(skills) && skills.length > 0) {
      for (const skillName of skills) {
        if (!skillName || !skillName.trim()) continue;
        const cleanName = skillName.trim();
        let skillRes = await db.query('SELECT id FROM skills WHERE LOWER(name) = LOWER($1)', [cleanName]);
        let skillId;
        if (skillRes.rows.length === 0) {
          skillId = uuidv4();
          await db.query('INSERT INTO skills (id, name) VALUES ($1, $2)', [skillId, cleanName]);
        } else {
          skillId = skillRes.rows[0].id;
        }
        await db.query('INSERT INTO user_skills (user_id, skill_id) VALUES ($1, $2)', [userId, skillId]);
      }
    }

    const token = generateToken(user.id);

    await logAuditEvent({
      actorId: user.id,
      action: 'USER_REGISTERED',
      entityType: 'USER',
      entityId: user.id,
      details: { email: normalizedEmail, method: 'email_password' }
    });

    res.status(201).json({
      message: 'Account created successfully',
      token,
      user
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Authenticate existing user with email and password (FR-02)
 */
async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Email and password are required.' }
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const userRes = await db.query(
      'SELECT id, name, email, password_hash, bio, avatar_url, github_username, portfolio_url, role, is_public FROM users WHERE email = $1',
      [normalizedEmail]
    );

    if (userRes.rows.length === 0) {
      return res.status(401).json({
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' }
      });
    }

    const userRecord = userRes.rows[0];

    // If user was registered solely via OAuth and has no password set
    if (!userRecord.password_hash) {
      return res.status(401).json({
        error: { code: 'OAUTH_ONLY_ACCOUNT', message: 'This account was created via GitHub OAuth. Please sign in using GitHub.' }
      });
    }

    const isMatch = await bcrypt.compare(password, userRecord.password_hash);
    if (!isMatch) {
      return res.status(401).json({
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' }
      });
    }

    const token = generateToken(userRecord.id);

    // Fetch user skills
    const skillsRes = await db.query(
      `SELECT s.id, s.name FROM skills s
       JOIN user_skills us ON s.id = us.skill_id
       WHERE us.user_id = $1`,
      [userRecord.id]
    );

    const { password_hash, ...safeUser } = userRecord;
    safeUser.skills = skillsRes.rows;

    await logAuditEvent({
      actorId: safeUser.id,
      action: 'USER_LOGIN',
      entityType: 'USER',
      entityId: safeUser.id,
      details: { method: 'email_password' }
    });

    res.json({
      message: 'Login successful',
      token,
      user: safeUser
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Get currently authenticated user session (FR-02)
 */
async function getMe(req, res, next) {
  try {
    const userRes = await db.query(
      'SELECT id, name, email, bio, avatar_url, github_username, portfolio_url, role, is_public, github_access_token, created_at FROM users WHERE id = $1',
      [req.user.id]
    );

    if (userRes.rows.length === 0) {
      return res.status(404).json({
        error: { code: 'USER_NOT_FOUND', message: 'User not found.' }
      });
    }

    const user = userRes.rows[0];
    const hasGitHubToken = Boolean(user.github_access_token);
    delete user.github_access_token; // Keep token private, expose boolean flag
    user.has_github_token = hasGitHubToken;

    const skillsRes = await db.query(
      `SELECT s.id, s.name FROM skills s
       JOIN user_skills us ON s.id = us.skill_id
       WHERE us.user_id = $1`,
      [user.id]
    );

    user.skills = skillsRes.rows;

    res.json({ user });
  } catch (err) {
    next(err);
  }
}

/**
 * Change account password (authenticated)
 */
async function changePassword(req, res, next) {
  try {
    const userId = req.user.id;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Both current password and new password are required.' }
      });
    }

    const passwordValidation = validatePasswordStrength(newPassword);
    if (!passwordValidation.valid) {
      return res.status(400).json({
        error: { code: 'WEAK_PASSWORD', message: passwordValidation.message }
      });
    }

    const userRes = await db.query('SELECT password_hash FROM users WHERE id = $1', [userId]);
    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: { code: 'USER_NOT_FOUND', message: 'User not found.' } });
    }

    const currentHash = userRes.rows[0].password_hash;
    const isCurrentMatch = await bcrypt.compare(currentPassword, currentHash);
    if (!isCurrentMatch) {
      return res.status(400).json({
        error: { code: 'INVALID_CURRENT_PASSWORD', message: 'Current password does not match.' }
      });
    }

    const isSamePassword = await bcrypt.compare(newPassword, currentHash);
    if (isSamePassword) {
      return res.status(400).json({
        error: { code: 'PASSWORD_SAME', message: 'New password must be different from current password.' }
      });
    }

    const salt = await bcrypt.genSalt(10);
    const newHash = await bcrypt.hash(newPassword, salt);

    await db.query(
      'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [newHash, userId]
    );

    await logAuditEvent({
      actorId: userId,
      action: 'PASSWORD_CHANGED',
      entityType: 'USER',
      entityId: userId
    });

    res.json({ message: 'Password updated successfully.' });
  } catch (err) {
    next(err);
  }
}

/**
 * Request password reset token
 */
async function forgotPassword(req, res, next) {
  try {
    const { email } = req.body;

    if (!email || !validateEmail(email)) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Please provide a valid email address.' }
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const userRes = await db.query('SELECT id FROM users WHERE email = $1', [normalizedEmail]);

    if (userRes.rows.length === 0) {
      // Return safe message to prevent email enumeration
      return res.json({
        message: 'If an account exists with this email, password reset instructions have been generated.'
      });
    }

    const user = userRes.rows[0];
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpires = new Date(Date.now() + 3600000).toISOString(); // 1 hour

    await db.query(
      'UPDATE users SET reset_token = $1, reset_token_expires = $2 WHERE id = $3',
      [resetToken, resetTokenExpires, user.id]
    );

    await logAuditEvent({
      actorId: user.id,
      action: 'PASSWORD_RESET_REQUESTED',
      entityType: 'USER',
      entityId: user.id
    });

    res.json({
      message: 'Password reset link generated successfully.',
      resetToken,
      resetLink: `${env.CLIENT_ORIGIN}/?reset_token=${resetToken}`
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Reset password using valid reset token
 */
async function resetPassword(req, res, next) {
  try {
    const { resetToken, newPassword } = req.body;

    if (!resetToken || !newPassword) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Reset token and new password are required.' }
      });
    }

    const passwordValidation = validatePasswordStrength(newPassword);
    if (!passwordValidation.valid) {
      return res.status(400).json({
        error: { code: 'WEAK_PASSWORD', message: passwordValidation.message }
      });
    }

    const userRes = await db.query('SELECT id, reset_token_expires FROM users WHERE reset_token = $1', [resetToken]);
    if (userRes.rows.length === 0) {
      return res.status(400).json({
        error: { code: 'INVALID_TOKEN', message: 'Password reset token is invalid or has already been used.' }
      });
    }

    const user = userRes.rows[0];
    if (user.reset_token_expires && new Date(user.reset_token_expires) < new Date()) {
      return res.status(400).json({
        error: { code: 'TOKEN_EXPIRED', message: 'Password reset token has expired. Please request a new one.' }
      });
    }

    const salt = await bcrypt.genSalt(10);
    const newHash = await bcrypt.hash(newPassword, salt);

    await db.query(
      "UPDATE users SET password_hash = $1, reset_token = '', reset_token_expires = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
      [newHash, user.id]
    );

    await logAuditEvent({
      actorId: user.id,
      action: 'PASSWORD_RESET_COMPLETED',
      entityType: 'USER',
      entityId: user.id
    });

    res.json({ message: 'Password has been reset successfully. You can now log in.' });
  } catch (err) {
    next(err);
  }
}

/**
 * Get GitHub OAuth configuration status
 */
function getGitHubAuthStatus(req, res) {
  const isConfigured = Boolean(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET);
  res.json({
    configured: isConfigured,
    clientId: isConfigured ? `${env.GITHUB_CLIENT_ID.slice(0, 6)}...` : null,
    redirectUri: env.GITHUB_REDIRECT_URI,
    sandboxAvailable: true
  });
}

/**
 * Initiate GitHub OAuth flow (FR-20)
 */
function initiateGitHubAuth(req, res) {
  let returnOrigin = env.CLIENT_ORIGIN;
  const referer = req.headers.referer || req.headers.origin;
  if (req.query.origin) {
    returnOrigin = req.query.origin;
  } else if (referer) {
    try {
      const parsed = new URL(referer);
      returnOrigin = parsed.origin;
    } catch (e) {}
  }

  const statePayload = {
    nonce: crypto.randomBytes(8).toString('hex'),
    origin: returnOrigin
  };
  const state = Buffer.from(JSON.stringify(statePayload)).toString('base64url');

  // If real GitHub OAuth credentials are configured
  if (env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET) {
    const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${env.GITHUB_CLIENT_ID}&redirect_uri=${encodeURIComponent(env.GITHUB_REDIRECT_URI)}&scope=read:user,user:email,repo&state=${state}`;

    if (req.query.format === 'json') {
      return res.json({ url: githubAuthUrl, configured: true });
    }
    return res.redirect(githubAuthUrl);
  }

  // If not configured, redirect to GitHub Sandbox authorization
  const sandboxUrl = `/api/auth/github/sandbox?state=${state}&origin=${encodeURIComponent(returnOrigin)}`;
  if (req.query.format === 'json') {
    return res.json({ url: sandboxUrl, configured: false, sandbox: true });
  }
  return res.redirect(sandboxUrl);
}

/**
 * Handle GitHub OAuth callback
 */
async function handleGitHubCallback(req, res) {
  let redirectOrigin = env.CLIENT_ORIGIN;
  if (req.query.state) {
    try {
      const decoded = JSON.parse(Buffer.from(req.query.state, 'base64url').toString('utf8'));
      if (decoded.origin && (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(decoded.origin) || decoded.origin === env.CLIENT_ORIGIN)) {
        redirectOrigin = decoded.origin;
      }
    } catch (e) {}
  }

  try {
    const { code } = req.query;

    if (!code) {
      return res.redirect(`${redirectOrigin}/?auth_error=${encodeURIComponent('No authorization code received from GitHub')}`);
    }

    // Exchange code for GitHub access token
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify({
        client_id: env.GITHUB_CLIENT_ID,
        client_secret: env.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: env.GITHUB_REDIRECT_URI
      })
    });

    const tokenData = await tokenResponse.json();
    if (tokenData.error || !tokenData.access_token) {
      return res.redirect(`${redirectOrigin}/?auth_error=${encodeURIComponent(tokenData.error_description || 'GitHub OAuth token exchange failed')}`);
    }

    // Fetch user details from GitHub API
    const userResponse = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        'User-Agent': 'DevCollab-App'
      }
    });

    const ghUser = await userResponse.json();

    // Fetch user primary email
    let userEmail = ghUser.email;
    if (!userEmail) {
      const emailResponse = await fetch('https://api.github.com/user/emails', {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
          'User-Agent': 'DevCollab-App'
        }
      });
      const emails = await emailResponse.json();
      if (Array.isArray(emails)) {
        const primary = emails.find(e => e.primary && e.verified) || emails[0];
        userEmail = primary?.email;
      }
    }

    if (!userEmail) {
      userEmail = `${ghUser.login}@users.noreply.github.com`;
    }

    const normalizedEmail = userEmail.toLowerCase().trim();

    // Look up existing user by email or github_username
    let userRes = await db.query(
      'SELECT id, name, email FROM users WHERE email = $1 OR github_username = $2',
      [normalizedEmail, ghUser.login]
    );

    let userId;
    if (userRes.rows.length > 0) {
      userId = userRes.rows[0].id;
      await db.query(
        `UPDATE users
         SET github_username = $1, github_id = $2, github_access_token = $3, avatar_url = COALESCE(NULLIF(avatar_url, ''), $4), updated_at = CURRENT_TIMESTAMP
         WHERE id = $5`,
        [ghUser.login, String(ghUser.id), tokenData.access_token, ghUser.avatar_url || '', userId]
      );
    } else {
      userId = uuidv4();
      const salt = await bcrypt.genSalt(10);
      const randomPasswordHash = await bcrypt.hash(uuidv4(), salt);

      await db.query(
        `INSERT INTO users (id, name, email, password_hash, bio, avatar_url, github_username, github_id, github_access_token, role, is_public, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'user', TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [
          userId,
          ghUser.name || ghUser.login,
          normalizedEmail,
          randomPasswordHash,
          ghUser.bio || '',
          ghUser.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(normalizedEmail)}`,
          ghUser.login,
          String(ghUser.id),
          tokenData.access_token
        ]
      );
    }

    const token = generateToken(userId);

    await logAuditEvent({
      actorId: userId,
      action: 'USER_LOGIN_GITHUB',
      entityType: 'USER',
      entityId: userId,
      details: { githubUsername: ghUser.login }
    });

    res.redirect(`${redirectOrigin}/?token=${token}&github_connected=true`);
  } catch (err) {
    console.error('[GitHub OAuth Error]:', err);
    res.redirect(`${redirectOrigin}/?auth_error=${encodeURIComponent(err.message || 'GitHub OAuth verification failed')}`);
  }
}

/**
 * Seamless GitHub Sandbox Authorization for zero-configuration local development & testing
 */
async function handleGitHubSandboxAuth(req, res, next) {
  try {
    let redirectOrigin = env.CLIENT_ORIGIN;
    const originParam = req.query.origin || req.headers.referer;
    if (req.query.state) {
      try {
        const decoded = JSON.parse(Buffer.from(req.query.state, 'base64url').toString('utf8'));
        if (decoded.origin && (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(decoded.origin) || decoded.origin === env.CLIENT_ORIGIN)) {
          redirectOrigin = decoded.origin;
        }
      } catch (e) {}
    } else if (originParam) {
      try {
        const parsed = new URL(originParam);
        if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(parsed.origin) || parsed.origin === env.CLIENT_ORIGIN) {
          redirectOrigin = parsed.origin;
        }
      } catch (e) {}
    }

    const sandboxUsername = req.query.username || 'octocat-dev';
    const sandboxEmail = `${sandboxUsername}@users.noreply.github.com`.toLowerCase();

    let userRes = await db.query('SELECT id FROM users WHERE email = $1', [sandboxEmail]);
    let userId;

    if (userRes.rows.length > 0) {
      userId = userRes.rows[0].id;
    } else {
      userId = uuidv4();
      const salt = await bcrypt.genSalt(10);
      const randomPasswordHash = await bcrypt.hash('password123', salt);

      await db.query(
        `INSERT INTO users (id, name, email, password_hash, bio, avatar_url, github_username, github_id, role, is_public, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'user', TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [
          userId,
          'Octocat Developer',
          sandboxEmail,
          randomPasswordHash,
          'Software Engineer connected via GitHub OAuth Sandbox',
          'https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png',
          sandboxUsername,
          'gh_sandbox_99421'
        ]
      );
    }

    const token = generateToken(userId);

    await logAuditEvent({
      actorId: userId,
      action: 'USER_LOGIN_GITHUB_SANDBOX',
      entityType: 'USER',
      entityId: userId,
      details: { githubUsername: sandboxUsername, mode: 'sandbox' }
    });

    res.redirect(`${redirectOrigin}/?token=${token}&github_connected=true`);
  } catch (err) {
    next(err);
  }
}

/**
 * Get account security activity logs for the current user (FR-41)
 */
async function getUserSecurityLogs(req, res, next) {
  try {
    const logsRes = await db.query(
      `SELECT id, action, entity_type, details, created_at
       FROM audit_events
       WHERE actor_id = $1
       ORDER BY created_at DESC
       LIMIT 20`,
      [req.user.id]
    );

    const logs = logsRes.rows.map(log => {
      try {
        log.details = typeof log.details === 'string' ? JSON.parse(log.details) : log.details;
      } catch (e) {}
      return log;
    });

    res.json({ logs });
  } catch (err) {
    next(err);
  }
}

/**
 * Secure Logout (FR-02)
 */
async function logout(req, res, next) {
  try {
    if (req.user) {
      await logAuditEvent({
        actorId: req.user.id,
        action: 'USER_LOGOUT',
        entityType: 'USER',
        entityId: req.user.id
      });
    }
    res.json({ message: 'Logout successful' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  register,
  login,
  getMe,
  changePassword,
  forgotPassword,
  resetPassword,
  getGitHubAuthStatus,
  initiateGitHubAuth,
  handleGitHubCallback,
  handleGitHubSandboxAuth,
  getUserSecurityLogs,
  logout
};
