const express = require('express');
const router = express.Router();
const editorController = require('./editorController');
const { authenticate, requireProjectRole } = require('../../middleware/auth');

router.use(authenticate);

router.get('/:projectId/documents', requireProjectRole(['owner', 'contributor', 'reviewer', 'viewer']), editorController.listDocuments);
router.get('/:projectId/documents/:documentId', requireProjectRole(['owner', 'contributor', 'reviewer', 'viewer']), editorController.getDocument);
router.post('/:projectId/documents', requireProjectRole(['owner', 'contributor']), editorController.createDocument);
router.put('/:projectId/documents/:documentId', requireProjectRole(['owner', 'contributor', 'reviewer']), editorController.saveDocument);
router.delete('/:projectId/documents/:documentId', requireProjectRole(['owner', 'contributor']), editorController.deleteDocument);

module.exports = router;
