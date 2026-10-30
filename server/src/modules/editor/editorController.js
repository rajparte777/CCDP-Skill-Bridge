const { v4: uuidv4 } = require('uuid');
const db = require('../../config/db');
const { logAuditEvent } = require('../audit/auditService');

function detectLanguage(filePath) {
  const ext = filePath.split('.').pop().toLowerCase();
  const map = {
    js: 'javascript',
    jsx: 'javascript',
    ts: 'typescript',
    tsx: 'typescript',
    py: 'python',
    html: 'html',
    css: 'css',
    json: 'json',
    md: 'markdown',
    sql: 'sql',
    sh: 'shell',
    yaml: 'yaml',
    yml: 'yaml'
  };
  return map[ext] || 'plaintext';
}

async function listDocuments(req, res, next) {
  try {
    const { projectId } = req.params;
    const result = await db.query(
      `SELECT id, project_id, file_path, language, updated_by, created_at, updated_at
       FROM editor_documents
       WHERE project_id = $1
       ORDER BY file_path ASC`,
      [projectId]
    );

    res.json({ documents: result.rows });
  } catch (err) {
    next(err);
  }
}

async function getDocument(req, res, next) {
  try {
    const { projectId, documentId } = req.params;

    const result = await db.query(
      `SELECT d.*, u.name as updated_by_name
       FROM editor_documents d
       LEFT JOIN users u ON d.updated_by = u.id
       WHERE d.id = $1 AND d.project_id = $2`,
      [documentId, projectId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: { code: 'DOCUMENT_NOT_FOUND', message: 'Document not found.' }
      });
    }

    res.json({ document: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

async function createDocument(req, res, next) {
  try {
    const { projectId } = req.params;
    const { file_path, content = '', language } = req.body;

    if (!file_path || !file_path.trim()) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'File path is required.' }
      });
    }

    const cleanPath = file_path.trim().replace(/^\/+/, '');
    const lang = language || detectLanguage(cleanPath);

    // Check if file already exists in project
    const existing = await db.query(
      'SELECT id FROM editor_documents WHERE project_id = $1 AND file_path = $2',
      [projectId, cleanPath]
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({
        error: { code: 'FILE_EXISTS', message: 'A file with this path already exists in this project.' }
      });
    }

    const docId = uuidv4();
    const result = await db.query(
      `INSERT INTO editor_documents (id, project_id, file_path, content, language, updated_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING *`,
      [docId, projectId, cleanPath, content, lang, req.user.id]
    );

    await logAuditEvent({
      actorId: req.user.id,
      action: 'DOCUMENT_CREATED',
      entityType: 'EDITOR_DOCUMENT',
      entityId: docId,
      details: { projectId, filePath: cleanPath }
    });

    res.status(201).json({
      message: 'Document created successfully',
      document: result.rows[0]
    });
  } catch (err) {
    next(err);
  }
}

async function saveDocument(req, res, next) {
  try {
    const { projectId, documentId } = req.params;
    const { content } = req.body;

    // Check permissions (FR-25, BR-06: viewer cannot edit)
    if (req.projectRole === 'viewer') {
      return res.status(403).json({
        error: { code: 'FORBIDDEN', message: 'Viewers cannot save changes to documents.' }
      });
    }

    if (content === undefined || content === null) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Document content is required.' }
      });
    }

    const updateRes = await db.query(
      `UPDATE editor_documents
       SET content = $1, updated_by = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3 AND project_id = $4
       RETURNING *`,
      [content, req.user.id, documentId, projectId]
    );

    if (updateRes.rows.length === 0) {
      return res.status(404).json({
        error: { code: 'DOCUMENT_NOT_FOUND', message: 'Document not found.' }
      });
    }

    // Record snapshot / update log for recovery (FR-24)
    const updateLogId = uuidv4();
    await db.query(
      `INSERT INTO document_updates (id, document_id, update_data, created_at)
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP)`,
      [updateLogId, documentId, JSON.stringify({ length: content.length, timestamp: Date.now() })]
    );

    res.json({
      message: 'Document saved successfully',
      document: updateRes.rows[0]
    });
  } catch (err) {
    next(err);
  }
}

async function deleteDocument(req, res, next) {
  try {
    const { projectId, documentId } = req.params;

    if (req.projectRole === 'viewer') {
      return res.status(403).json({
        error: { code: 'FORBIDDEN', message: 'Viewers cannot delete documents.' }
      });
    }

    await db.query('DELETE FROM editor_documents WHERE id = $1 AND project_id = $2', [documentId, projectId]);

    res.json({ message: 'Document deleted successfully' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listDocuments,
  getDocument,
  createDocument,
  saveDocument,
  deleteDocument
};
