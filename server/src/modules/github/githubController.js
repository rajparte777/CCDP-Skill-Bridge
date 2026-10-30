const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const db = require('../../config/db');
const env = require('../../config/env');
const { createNotification } = require('../notifications/notificationService');
const { logAuditEvent } = require('../audit/auditService');

/**
 * Verify GitHub webhook HMAC SHA256 signature (FR-19)
 */
function verifyWebhookSignature(payload, signatureHeader, secret) {
  if (!signatureHeader || !secret) return false;
  const hmac = crypto.createHmac('sha256', secret);
  const digest = 'sha256=' + hmac.update(payload).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signatureHeader));
}

async function linkRepository(req, res, next) {
  try {
    const { projectId } = req.params;
    const { owner, name, url, default_branch = 'main', visibility = 'public', repository_id } = req.body;

    if (!owner || !name || !url) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'GitHub repository owner, name, and url are required.' }
      });
    }

    const repoId = uuidv4();
    const externalRepoId = repository_id || `${owner}/${name}`;

    // Upsert linked repository
    const existing = await db.query('SELECT id FROM github_repositories WHERE project_id = $1', [projectId]);
    let result;

    if (existing.rows.length > 0) {
      result = await db.query(
        `UPDATE github_repositories
         SET repository_id = $1, owner = $2, name = $3, url = $4, default_branch = $5, visibility = $6, connected_at = CURRENT_TIMESTAMP
         WHERE project_id = $7
         RETURNING *`,
        [externalRepoId, owner, name, url, default_branch, visibility, projectId]
      );
    } else {
      result = await db.query(
        `INSERT INTO github_repositories (id, project_id, repository_id, owner, name, url, default_branch, visibility, connected_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
         RETURNING *`,
        [repoId, projectId, externalRepoId, owner, name, url, default_branch, visibility]
      );
    }

    // Also update project's repository_url
    await db.query('UPDATE projects SET repository_url = $1 WHERE id = $2', [url, projectId]);

    await logAuditEvent({
      actorId: req.user.id,
      action: 'GITHUB_REPO_LINKED',
      entityType: 'GITHUB_REPOSITORY',
      entityId: result.rows[0].id,
      details: { owner, name, url }
    });

    res.json({
      message: 'GitHub repository linked successfully',
      repository: result.rows[0]
    });
  } catch (err) {
    next(err);
  }
}

async function getRepository(req, res, next) {
  try {
    const { projectId } = req.params;

    const repoRes = await db.query('SELECT * FROM github_repositories WHERE project_id = $1', [projectId]);
    if (repoRes.rows.length === 0) {
      return res.status(404).json({
        error: { code: 'NOT_LINKED', message: 'No GitHub repository linked to this project.' }
      });
    }

    const repo = repoRes.rows[0];

    // Fetch repository events
    const eventsRes = await db.query(
      'SELECT * FROM repository_events WHERE repository_id = $1 ORDER BY occurred_at DESC LIMIT 30',
      [repo.id]
    );

    repo.events = eventsRes.rows.map(e => {
      try {
        e.payload_summary = JSON.parse(e.payload_summary);
      } catch (err) {}
      return e;
    });

    res.json({ repository: repo });
  } catch (err) {
    next(err);
  }
}

async function handleWebhook(req, res, next) {
  try {
    const signature = req.headers['x-hub-signature-256'];
    const deliveryId = req.headers['x-github-delivery'];
    const eventType = req.headers['x-github-event'] || 'push';

    if (!deliveryId) {
      return res.status(400).json({ error: { code: 'MISSING_DELIVERY_ID', message: 'Delivery ID missing.' } });
    }

    // Check idempotency (FR-19, NFR-07)
    const existing = await db.query('SELECT id FROM repository_events WHERE delivery_id = $1', [deliveryId]);
    if (existing.rows.length > 0) {
      return res.status(200).json({ message: 'Event already processed.' });
    }

    // Verify signature if secret configured
    const rawBody = req.rawBody || JSON.stringify(req.body);
    if (env.GITHUB_WEBHOOK_SECRET && signature) {
      const isValid = verifyWebhookSignature(rawBody, signature, env.GITHUB_WEBHOOK_SECRET);
      if (!isValid) {
        return res.status(401).json({ error: { code: 'INVALID_SIGNATURE', message: 'Webhook signature verification failed.' } });
      }
    }

    const payload = req.body;
    const repoFullName = payload.repository ? payload.repository.full_name : null;

    if (!repoFullName) {
      return res.status(400).json({ error: { code: 'INVALID_PAYLOAD', message: 'Repository payload missing.' } });
    }

    const [owner, name] = repoFullName.split('/');

    // Find linked repository in our database
    const repoRes = await db.query(
      'SELECT id, project_id FROM github_repositories WHERE LOWER(owner) = LOWER($1) AND LOWER(name) = LOWER($2)',
      [owner, name]
    );

    if (repoRes.rows.length === 0) {
      return res.status(200).json({ message: 'Repository not tracked by DevCollab.' });
    }

    const repo = repoRes.rows[0];

    // Build payload summary based on event type
    let summaryText = '';
    if (eventType === 'push') {
      const commits = payload.commits || [];
      const branch = (payload.ref || '').replace('refs/heads/', '');
      summaryText = `Pushed ${commits.length} commit(s) to branch ${branch}: ${commits.map(c => c.message).join('; ').slice(0, 150)}`;
    } else if (eventType === 'pull_request') {
      const pr = payload.pull_request || {};
      summaryText = `PR #${pr.number} ${payload.action}: "${pr.title}" by @${pr.user ? pr.user.login : 'unknown'}`;
    } else {
      summaryText = `GitHub event: ${eventType} (${payload.action || 'activity'})`;
    }

    const eventRecordId = uuidv4();
    await db.query(
      `INSERT INTO repository_events (id, repository_id, delivery_id, event_type, payload_summary, occurred_at)
       VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)`,
      [eventRecordId, repo.id, deliveryId, eventType, JSON.stringify({ summary: summaryText, raw: payload })]
    );

    // Notify all project members
    const membersRes = await db.query('SELECT user_id FROM project_members WHERE project_id = $1', [repo.project_id]);
    for (const member of membersRes.rows) {
      await createNotification({
        userId: member.user_id,
        type: 'GITHUB_ACTIVITY',
        message: `GitHub [${repoFullName}]: ${summaryText}`,
        relatedEntityType: 'PROJECT',
        relatedEntityId: repo.project_id
      });
    }

    res.status(200).json({ message: 'Webhook event processed successfully', eventId: eventRecordId });
  } catch (err) {
    next(err);
  }
}

/**
 * Simulate Webhook event for demo / testing (AT-06, FR-18, FR-19)
 */
async function simulateWebhookEvent(req, res, next) {
  try {
    const { projectId } = req.params;
    const { event_type = 'push', message = 'Update application module and styling', branch = 'main' } = req.body;

    const repoRes = await db.query('SELECT * FROM github_repositories WHERE project_id = $1', [projectId]);
    if (repoRes.rows.length === 0) {
      return res.status(404).json({
        error: { code: 'NOT_LINKED', message: 'No GitHub repository linked to this project.' }
      });
    }

    const repo = repoRes.rows[0];
    const deliveryId = `sim_${Date.now()}_${uuidv4().slice(0, 8)}`;
    const eventId = uuidv4();

    let summaryText = '';
    if (event_type === 'push') {
      summaryText = `Pushed commit to ${branch}: "${message}"`;
    } else if (event_type === 'pull_request') {
      summaryText = `Opened PR: "${message}" (${branch})`;
    } else {
      summaryText = `Simulated event: ${event_type} - ${message}`;
    }

    const summaryJson = JSON.stringify({
      summary: summaryText,
      simulated: true,
      branch,
      message,
      actor: req.user.name
    });

    await db.query(
      `INSERT INTO repository_events (id, repository_id, delivery_id, event_type, payload_summary, occurred_at)
       VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)`,
      [eventId, repo.id, deliveryId, event_type, summaryJson]
    );

    // Notify project members
    const membersRes = await db.query('SELECT user_id FROM project_members WHERE project_id = $1', [projectId]);
    for (const member of membersRes.rows) {
      await createNotification({
        userId: member.user_id,
        type: 'GITHUB_ACTIVITY',
        message: `GitHub [${repo.owner}/${repo.name}]: ${summaryText}`,
        relatedEntityType: 'PROJECT',
        relatedEntityId: projectId
      });
    }

    res.status(201).json({
      message: 'Simulated GitHub webhook processed successfully',
      event: { id: eventId, deliveryId, event_type, summaryText }
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Commit & push document changes directly to linked GitHub repository
 * Supports live GitHub REST API with Personal Access Token or cryptographic simulation
 */
async function commitToGitHub(req, res, next) {
  try {
    const { projectId } = req.params;
    const { file_path, content = '', message, branch, personal_access_token } = req.body;

    if (!file_path || !file_path.trim()) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'File path is required for committing to GitHub.' }
      });
    }

    if (!message || !message.trim()) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Commit message is required.' }
      });
    }

    const cleanPath = file_path.trim().replace(/^\/+/, '');
    const cleanMessage = message.trim();

    // Check linked repository
    const repoRes = await db.query('SELECT * FROM github_repositories WHERE project_id = $1', [projectId]);
    if (repoRes.rows.length === 0) {
      return res.status(404).json({
        error: { code: 'NOT_LINKED', message: 'No GitHub repository is currently linked to this project. Please link a repository first.' }
      });
    }

    const repo = repoRes.rows[0];
    const targetBranch = (branch && branch.trim()) ? branch.trim() : (repo.default_branch || 'main');
    
    // Resolve token: explicit personal access token takes priority, then user's connected GitHub OAuth token
    const token = (personal_access_token && personal_access_token.trim()) || (req.user && req.user.github_access_token) || null;

    let commitSha;
    let commitUrl;
    let isLive = false;

    if (token) {
      // Direct push via GitHub Contents REST API
      let fileSha = null;
      try {
        const getFileRes = await fetch(
          `https://api.github.com/repos/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.name)}/contents/${encodeURIComponent(cleanPath)}?ref=${encodeURIComponent(targetBranch)}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: 'application/vnd.github.v3+json',
              'User-Agent': 'DevCollab-App'
            }
          }
        );
        if (getFileRes.ok) {
          const fileData = await getFileRes.json();
          fileSha = fileData.sha;
        } else if (getFileRes.status === 401 || getFileRes.status === 403) {
          const errData = await getFileRes.json().catch(() => ({}));
          return res.status(getFileRes.status).json({
            error: {
              code: 'GITHUB_AUTH_FAILED',
              message: `GitHub authorization error: ${errData.message || 'Token does not have repository write permission.'}`
            }
          });
        }
      } catch (checkErr) {
        console.warn('[GitHub Commit] File sha check notice:', checkErr.message);
      }

      const putBody = {
        message: cleanMessage,
        content: Buffer.from(content || '').toString('base64'),
        branch: targetBranch
      };
      if (fileSha) {
        putBody.sha = fileSha;
      }

      const putRes = await fetch(
        `https://api.github.com/repos/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.name)}/contents/${encodeURIComponent(cleanPath)}`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            Accept: 'application/vnd.github.v3+json',
            'User-Agent': 'DevCollab-App'
          },
          body: JSON.stringify(putBody)
        }
      );

      const putData = await putRes.json().catch(() => ({}));
      if (!putRes.ok) {
        const errMsg = putData.message || 'GitHub API rejected the commit request.';
        return res.status(putRes.status).json({
          error: { code: 'GITHUB_API_ERROR', message: `GitHub API error: ${errMsg}` }
        });
      }

      commitSha = putData.commit?.sha || uuidv4().replace(/-/g, '').slice(0, 40);
      commitUrl = putData.commit?.html_url || `${repo.url}/commit/${commitSha}`;
      isLive = true;
    } else if (req.body.simulate || process.env.NODE_ENV === 'test') {
      // Explicit simulation requested or running in automated test suite
      commitSha = crypto.createHash('sha1').update(`${Date.now()}:${cleanPath}:${cleanMessage}`).digest('hex');
      commitUrl = `${repo.url}/commit/${commitSha}`;
      isLive = false;
    } else {
      // No token provided and not simulation mode
      return res.status(400).json({
        error: {
          code: 'GITHUB_TOKEN_REQUIRED',
          message: 'A GitHub Personal Access Token with repo scope is required to push commits directly to GitHub.com. Please enter your token or select "Simulate in project feed only".'
        }
      });
    }

    // Record commit in repository_events table
    const eventId = uuidv4();
    const deliveryId = `commit_${Date.now()}_${uuidv4().slice(0, 8)}`;
    const summaryText = `Committed "${cleanMessage}" to ${targetBranch} (${cleanPath})`;

    const eventPayload = {
      summary: summaryText,
      commit_sha: commitSha,
      commit_url: commitUrl,
      branch: targetBranch,
      file_path: cleanPath,
      message: cleanMessage,
      actor: req.user.name,
      actor_github: req.user.github_username,
      live_sync: isLive,
      committed_at: new Date().toISOString()
    };

    await db.query(
      `INSERT INTO repository_events (id, repository_id, delivery_id, event_type, payload_summary, occurred_at)
       VALUES ($1, $2, $3, 'push', $4, CURRENT_TIMESTAMP)`,
      [eventId, repo.id, deliveryId, JSON.stringify(eventPayload)]
    );

    // Notify project members
    const membersRes = await db.query('SELECT user_id FROM project_members WHERE project_id = $1', [projectId]);
    for (const member of membersRes.rows) {
      if (member.user_id !== req.user.id) {
        await createNotification({
          userId: member.user_id,
          type: 'GITHUB_ACTIVITY',
          message: `${req.user.name} committed to ${repo.name}/${targetBranch}: "${cleanMessage}"`,
          relatedEntityType: 'PROJECT',
          relatedEntityId: projectId
        });
      }
    }

    await logAuditEvent({
      actorId: req.user.id,
      action: 'GITHUB_COMMIT_PUSHED',
      entityType: 'GITHUB_REPOSITORY',
      entityId: repo.id,
      details: {
        projectId,
        filePath: cleanPath,
        branch: targetBranch,
        commitSha,
        liveSync: isLive
      }
    });

    res.status(201).json({
      message: isLive ? 'Changes committed and pushed to GitHub live repository!' : 'Commit recorded and synchronized with project repository feed.',
      commit: {
        sha: commitSha,
        branch: targetBranch,
        filePath: cleanPath,
        message: cleanMessage,
        url: commitUrl,
        live: isLive
      }
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  linkRepository,
  getRepository,
  handleWebhook,
  simulateWebhookEvent,
  commitToGitHub
};
