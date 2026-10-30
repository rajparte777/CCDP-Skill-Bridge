import React, { useState, useEffect, useRef } from 'react';
import Editor from '@monaco-editor/react';
import { api } from '../../services/api';
import { getSocket } from '../../services/socket';
import {
  FileCode, Plus, Save, Users, AlertCircle, CheckCircle2, ShieldAlert,
  Folder, FolderPlus, FolderOpen, ChevronRight, ChevronDown, GitCommit,
  ExternalLink, Trash2, GitBranch, Code
} from 'lucide-react';
import Modal from '../../components/Modal';

function GithubIcon({ size = 15 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
    </svg>
  );
}

export default function CollaborativeEditor({ projectId, projectRole, currentUser }) {
  const [documents, setDocuments] = useState([]);
  const [activeDoc, setActiveDoc] = useState(null);
  const [content, setContent] = useState('');
  const [collaborators, setCollaborators] = useState([]);
  const [saveStatus, setSaveStatus] = useState('saved'); // 'saved', 'saving', 'unsaved'
  const [isReadOnly, setIsReadOnly] = useState(projectRole === 'viewer');

  // File & Folder modal states
  const [isNewFileModalOpen, setIsNewFileModalOpen] = useState(false);
  const [newFilePath, setNewFilePath] = useState('');
  const [targetFolder, setTargetFolder] = useState('');

  const [isNewFolderModalOpen, setIsNewFolderModalOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [folderParent, setFolderParent] = useState('');

  // Folder collapse state: { [folderPath]: boolean (true if collapsed) }
  const [collapsedFolders, setCollapsedFolders] = useState({});

  // GitHub integration & commit modal states
  const [linkedRepo, setLinkedRepo] = useState(null);
  const [isCommitModalOpen, setIsCommitModalOpen] = useState(false);
  const [commitMessage, setCommitMessage] = useState('');
  const [commitBranch, setCommitBranch] = useState('main');
  const [personalAccessToken, setPersonalAccessToken] = useState('');
  const [rememberPat, setRememberPat] = useState(true);
  const [simulateOnly, setSimulateOnly] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [commitSuccess, setCommitSuccess] = useState(null);
  const [commitError, setCommitError] = useState(null);

  const editorRef = useRef(null);
  const isRemoteChange = useRef(false);

  useEffect(() => {
    const saved = localStorage.getItem('devcollab_github_pat');
    if (saved) {
      setPersonalAccessToken(saved);
    }
  }, []);

  useEffect(() => {
    setIsReadOnly(projectRole === 'viewer');
  }, [projectRole]);

  useEffect(() => {
    loadDocuments();
    loadLinkedRepo();
  }, [projectId]);

  async function loadLinkedRepo() {
    try {
      const res = await api.get(`/github/projects/${projectId}`);
      if (res.repository) {
        setLinkedRepo(res.repository);
        if (res.repository.default_branch) {
          setCommitBranch(res.repository.default_branch);
        }
      }
    } catch (err) {
      // Not linked yet
      setLinkedRepo(null);
    }
  }

  async function loadDocuments() {
    try {
      const res = await api.get(`/editor/${projectId}/documents`);
      const docs = res.documents || [];
      setDocuments(docs);
      if (docs.length > 0 && !activeDoc) {
        selectDocument(docs[0].id);
      }
    } catch (err) {
      console.error('Failed to load documents:', err);
    }
  }

  async function selectDocument(docId) {
    const socket = getSocket();
    if (activeDoc && socket) {
      socket.emit('doc:leave', { documentId: activeDoc.id });
    }

    try {
      const res = await api.get(`/editor/${projectId}/documents/${docId}`);
      const doc = res.document;
      setActiveDoc(doc);
      setContent(doc.content || '');
      setSaveStatus('saved');

      // Join real-time room
      if (socket) {
        socket.emit('doc:join', { projectId, documentId: doc.id });
      }
    } catch (err) {
      console.error('Failed to fetch document:', err);
    }
  }

  // Socket.IO real-time event listeners
  useEffect(() => {
    const socket = getSocket();
    if (!socket || !activeDoc) return;

    function handleDocInit(data) {
      if (data.documentId === activeDoc.id) {
        isRemoteChange.current = true;
        setContent(data.content);
        if (data.role === 'viewer') {
          setIsReadOnly(true);
        }
      }
    }

    function handleDocChange(data) {
      if (data.documentId === activeDoc.id) {
        isRemoteChange.current = true;
        setContent(data.content);
      }
    }

    function handleDocPresence(data) {
      if (data.documentId === activeDoc.id) {
        setCollaborators(data.collaborators || []);
      }
    }

    function handleDocSaved(data) {
      if (data.documentId === activeDoc.id) {
        setSaveStatus('saved');
      }
    }

    socket.on('doc:init', handleDocInit);
    socket.on('doc:change', handleDocChange);
    socket.on('doc:presence', handleDocPresence);
    socket.on('doc:saved', handleDocSaved);

    return () => {
      socket.off('doc:init', handleDocInit);
      socket.off('doc:change', handleDocChange);
      socket.off('doc:presence', handleDocPresence);
      socket.off('doc:saved', handleDocSaved);
      socket.emit('doc:leave', { documentId: activeDoc.id });
    };
  }, [activeDoc]);

  function handleEditorChange(newVal) {
    if (isRemoteChange.current) {
      isRemoteChange.current = false;
      return;
    }

    setContent(newVal);
    setSaveStatus('unsaved');

    const socket = getSocket();
    if (socket && activeDoc && !isReadOnly) {
      socket.emit('doc:edit', {
        projectId,
        documentId: activeDoc.id,
        content: newVal
      });
      setSaveStatus('saving');
    }
  }

  async function handleManualSave() {
    if (!activeDoc || isReadOnly) return;
    try {
      setSaveStatus('saving');
      await api.put(`/editor/${projectId}/documents/${activeDoc.id}`, { content });
      setSaveStatus('saved');
    } catch (err) {
      console.error('Failed to manually save:', err);
      alert(err.message || 'Failed to save document');
    }
  }

  async function handleCreateFile(e) {
    e.preventDefault();
    if (!newFilePath.trim()) return;

    // Combine with target folder if selected
    let fullPath = newFilePath.trim().replace(/^\/+/, '');
    if (targetFolder && !fullPath.startsWith(targetFolder + '/')) {
      fullPath = `${targetFolder}/${fullPath}`;
    }

    try {
      const res = await api.post(`/editor/${projectId}/documents`, {
        file_path: fullPath,
        content: `// ${fullPath}\n`
      });
      setIsNewFileModalOpen(false);
      setNewFilePath('');
      setTargetFolder('');
      await loadDocuments();
      selectDocument(res.document.id);
    } catch (err) {
      alert(err.message || 'Failed to create file');
    }
  }

  async function handleCreateFolder(e) {
    e.preventDefault();
    if (!newFolderName.trim()) return;

    let folderPath = newFolderName.trim().replace(/^\/+|\/+$/g, '');
    if (folderParent) {
      folderPath = `${folderParent}/${folderPath}`;
    }

    // Git directories require an initial file placeholder (standard .gitkeep)
    const keepFilePath = `${folderPath}/.gitkeep`;

    try {
      const res = await api.post(`/editor/${projectId}/documents`, {
        file_path: keepFilePath,
        content: `# Directory placeholder for ${folderPath}\n`
      });
      setIsNewFolderModalOpen(false);
      setNewFolderName('');
      setFolderParent('');

      // Ensure new folder is expanded
      setCollapsedFolders(prev => ({ ...prev, [folderPath]: false }));
      await loadDocuments();
      selectDocument(res.document.id);
    } catch (err) {
      alert(err.message || 'Failed to create folder');
    }
  }

  async function handleDeleteFile(docId, filePath, e) {
    e.stopPropagation();
    if (isReadOnly) return;

    if (!window.confirm(`Are you sure you want to delete "${filePath}"?`)) {
      return;
    }

    try {
      await api.delete(`/editor/${projectId}/documents/${docId}`);
      if (activeDoc?.id === docId) {
        setActiveDoc(null);
        setContent('');
      }
      await loadDocuments();
    } catch (err) {
      alert(err.message || 'Failed to delete document');
    }
  }

  function toggleFolder(folderPath, e) {
    e.stopPropagation();
    setCollapsedFolders(prev => ({
      ...prev,
      [folderPath]: !prev[folderPath]
    }));
  }

  // Open Commit Modal with default commit message
  function openCommitModal() {
    if (!activeDoc) return;
    setCommitMessage(`Update ${activeDoc.file_path}`);
    setCommitError(null);
    setCommitSuccess(null);
    setIsCommitModalOpen(true);
  }

  async function handleCommitToGitHub(e) {
    e.preventDefault();
    if (!commitMessage.trim()) return;

    if (!simulateOnly && !personalAccessToken.trim() && !currentUser?.has_github_token) {
      setCommitError("A GitHub Personal Access Token with 'repo' scope is required to push commits to your live GitHub repository. Please enter your token below or check 'Simulate in project feed only'.");
      return;
    }

    setIsCommitting(true);
    setCommitError(null);
    setCommitSuccess(null);

    try {
      if (rememberPat && personalAccessToken.trim()) {
        localStorage.setItem('devcollab_github_pat', personalAccessToken.trim());
      } else if (!rememberPat) {
        localStorage.removeItem('devcollab_github_pat');
      }

      const res = await api.post(`/github/projects/${projectId}/commit`, {
        file_path: activeDoc.file_path,
        content: content,
        message: commitMessage.trim(),
        branch: commitBranch.trim() || 'main',
        personal_access_token: personalAccessToken.trim() || undefined,
        simulate: Boolean(simulateOnly)
      });

      setCommitSuccess(res.commit);
      setSaveStatus('saved');
    } catch (err) {
      setCommitError(err.message || 'Failed to push commit to GitHub.');
    } finally {
      setIsCommitting(false);
    }
  }

  // Build hierarchical folder tree from flat documents array
  function buildFileTree(docs) {
    const root = { path: '', folders: {}, files: [] };

    docs.forEach(doc => {
      const parts = doc.file_path.split('/').filter(Boolean);
      const fileName = parts.pop();
      let current = root;
      let curPath = '';

      for (const part of parts) {
        curPath = curPath ? `${curPath}/${part}` : part;
        if (!current.folders[part]) {
          current.folders[part] = {
            name: part,
            path: curPath,
            folders: {},
            files: []
          };
        }
        current = current.folders[part];
      }

      current.files.push({ ...doc, fileName });
    });

    return root;
  }

  const fileTree = buildFileTree(documents);

  // Helper to color-code file icons based on extension
  function getFileIconColor(fileName) {
    if (fileName.endsWith('.js') || fileName.endsWith('.jsx')) return '#e3b341';
    if (fileName.endsWith('.ts') || fileName.endsWith('.tsx')) return '#3178c6';
    if (fileName.endsWith('.css') || fileName.endsWith('.scss')) return '#563d7c';
    if (fileName.endsWith('.html')) return '#e34c26';
    if (fileName.endsWith('.json')) return '#cbcb41';
    if (fileName.endsWith('.md')) return '#a371f7';
    if (fileName.endsWith('.sql')) return '#388bfd';
    if (fileName.endsWith('.gitkeep')) return 'var(--text-dim)';
    return 'var(--accent-blue)';
  }

  // Recursive Tree Renderer
  function renderTreeNode(node, depth = 0) {
    const folderKeys = Object.keys(node.folders).sort();
    const sortedFiles = [...node.files].sort((a, b) => a.fileName.localeCompare(b.fileName));

    return (
      <div key={node.path || 'root'}>
        {/* Render Subfolders */}
        {folderKeys.map(key => {
          const folder = node.folders[key];
          const isCollapsed = Boolean(collapsedFolders[folder.path]);
          const totalChildren = Object.keys(folder.folders).length + folder.files.length;

          return (
            <div key={folder.path}>
              <div
                className="folder-item"
                style={{ paddingLeft: `${8 + depth * 14}px` }}
                onClick={(e) => toggleFolder(folder.path, e)}
                title={folder.path}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, overflow: 'hidden' }}>
                  <span style={{ color: 'var(--text-dim)', display: 'inline-flex' }}>
                    {isCollapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
                  </span>
                  {isCollapsed ? (
                    <Folder size={15} style={{ color: '#e3b341', flexShrink: 0 }} />
                  ) : (
                    <FolderOpen size={15} style={{ color: '#e3b341', flexShrink: 0 }} />
                  )}
                  <span style={{
                    fontWeight: 600,
                    color: 'var(--text-main)',
                    fontSize: '0.84rem',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {folder.name}
                  </span>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                    ({totalChildren})
                  </span>
                </div>

                {!isReadOnly && (
                  <button
                    type="button"
                    className="file-tree-btn"
                    title={`Add new file inside ${folder.path}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setTargetFolder(folder.path);
                      setIsNewFileModalOpen(true);
                    }}
                  >
                    <Plus size={12} />
                  </button>
                )}
              </div>

              {!isCollapsed && renderTreeNode(folder, depth + 1)}
            </div>
          );
        })}

        {/* Render Files */}
        {sortedFiles.map(file => {
          const isActive = activeDoc?.id === file.id;
          const isKeep = file.fileName === '.gitkeep';

          return (
            <div
              key={file.id}
              className={`file-item ${isActive ? 'active' : ''}`}
              style={{
                paddingLeft: `${18 + depth * 14}px`,
                justifyContent: 'space-between'
              }}
              onClick={() => selectDocument(file.id)}
              title={file.file_path}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0, overflow: 'hidden' }}>
                <FileCode size={14} style={{ color: getFileIconColor(file.fileName), flexShrink: 0 }} />
                <span style={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  fontStyle: isKeep ? 'italic' : 'normal',
                  opacity: isKeep ? 0.75 : 1
                }}>
                  {file.fileName}
                </span>
              </div>

              {!isReadOnly && (
                <button
                  type="button"
                  className="file-tree-btn"
                  title={`Delete ${file.fileName}`}
                  onClick={(e) => handleDeleteFile(file.id, file.file_path, e)}
                  style={{ opacity: isActive ? 0.9 : undefined }}
                >
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div>
      {/* Viewer alert notice */}
      {isReadOnly && (
        <div style={{
          background: 'var(--accent-amber-bg)',
          color: 'var(--accent-amber)',
          border: '1px solid rgba(210, 153, 34, 0.4)',
          padding: '8px 14px',
          borderRadius: 'var(--radius-sm)',
          fontSize: '0.82rem',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 12
        }}>
          <ShieldAlert size={16} />
          <span>Read-only Mode: You have viewer role on this project and cannot modify code documents.</span>
        </div>
      )}

      {/* Editor Layout */}
      <div className="editor-layout">
        {/* Left File Tree Sidebar */}
        <div className="editor-sidebar">
          <div className="editor-sidebar-header">
            <span>Explorer</span>
            {!isReadOnly && (
              <div style={{ display: 'flex', gap: 4 }}>
                <button
                  className="btn btn-secondary btn-sm"
                  style={{ padding: '3px 6px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: 3 }}
                  onClick={() => {
                    setTargetFolder('');
                    setIsNewFileModalOpen(true);
                  }}
                  title="Create New File"
                >
                  <Plus size={12} />
                  <span>File</span>
                </button>
                <button
                  className="btn btn-secondary btn-sm"
                  style={{ padding: '3px 6px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: 3 }}
                  onClick={() => {
                    setFolderParent('');
                    setIsNewFolderModalOpen(true);
                  }}
                  title="Create New Folder"
                >
                  <FolderPlus size={12} style={{ color: '#e3b341' }} />
                  <span>Folder</span>
                </button>
              </div>
            )}
          </div>

          {/* Tree View Body */}
          <div style={{ overflowY: 'auto', flex: 1, padding: '4px 0' }}>
            {documents.length === 0 ? (
              <div style={{ padding: '20px 14px', textAlign: 'center', color: 'var(--text-dim)', fontSize: '0.82rem' }}>
                No files created yet.
              </div>
            ) : (
              renderTreeNode(fileTree, 0)
            )}
          </div>
        </div>

        {/* Right Monaco Editor Main Area */}
        <div className="editor-main">
          {/* Toolbar */}
          <div className="editor-toolbar">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 600, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.9rem' }}>
                <FileCode size={16} style={{ color: activeDoc ? getFileIconColor(activeDoc.file_path) : 'var(--accent-blue)' }} />
                <span>{activeDoc ? activeDoc.file_path : 'No file selected'}</span>
              </span>

              {/* Save status badge */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', color: 'var(--text-dim)' }}>
                {saveStatus === 'saved' && (
                  <span style={{ color: 'var(--accent-green)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <CheckCircle2 size={13} /> Auto-saved
                  </span>
                )}
                {saveStatus === 'saving' && (
                  <span style={{ color: 'var(--accent-amber)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    Saving...
                  </span>
                )}
                {saveStatus === 'unsaved' && (
                  <span style={{ color: 'var(--text-dim)' }}>
                    Unsaved edits
                  </span>
                )}
              </div>
            </div>

            {/* Right Presence & Actions */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              {/* Presence list */}
              <div className="presence-avatars" title="Active collaborators currently editing this document">
                <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginRight: 4 }}>Editing now:</span>
                {collaborators.length === 0 ? (
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Only you</span>
                ) : (
                  collaborators.map((c, i) => (
                    <div key={i} className="presence-chip" title={`${c.userName} (${c.role})`}>
                      <span className="presence-dot" />
                      <span>{c.userName.split(' ')[0]}</span>
                    </div>
                  ))
                )}
              </div>

              {!isReadOnly && (
                <>
                  <button className="btn btn-secondary btn-sm" onClick={handleManualSave} title="Save changes to DevCollab workspace">
                    <Save size={13} />
                    <span>Save</span>
                  </button>

                  <button
                    className="btn btn-primary btn-sm"
                    onClick={openCommitModal}
                    disabled={!activeDoc}
                    title="Commit this file directly to the linked GitHub repository"
                    style={{ background: '#238636', borderColor: 'rgba(240, 246, 252, 0.1)', display: 'flex', alignItems: 'center', gap: 6 }}
                  >
                    <GitCommit size={14} />
                    <span>Commit to GitHub</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Monaco Mount */}
          <div style={{ flex: 1, minHeight: 0 }}>
            {activeDoc ? (
              <Editor
                height="100%"
                theme="vs-dark"
                language={activeDoc.language || 'javascript'}
                value={content}
                onChange={handleEditorChange}
                options={{
                  readOnly: isReadOnly,
                  minimap: { enabled: false },
                  fontSize: 13,
                  lineNumbers: 'on',
                  scrollBeyondLastLine: false,
                  wordWrap: 'on',
                  tabSize: 2,
                  automaticLayout: true
                }}
              />
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-dim)' }}>
                Select a file from the explorer to begin editing
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ===================== NEW FILE MODAL ===================== */}
      <Modal
        isOpen={isNewFileModalOpen}
        onClose={() => {
          setIsNewFileModalOpen(false);
          setNewFilePath('');
          setTargetFolder('');
        }}
        title="Create New File"
      >
        <form onSubmit={handleCreateFile}>
          {targetFolder && (
            <div style={{
              background: '#111419',
              border: '1px solid var(--border-color)',
              padding: '8px 12px',
              borderRadius: 'var(--radius-sm)',
              marginBottom: 14,
              fontSize: '0.82rem',
              color: 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}>
              <Folder size={14} style={{ color: '#e3b341' }} />
              <span>Target Directory: <strong style={{ color: 'var(--accent-blue)' }}>{targetFolder}/</strong></span>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">File Name or Path *</label>
            <input
              type="text"
              className="input-text"
              placeholder={targetFolder ? "e.g. Navbar.jsx or styles.css" : "e.g. src/auth/jwtService.js or styles/main.css"}
              value={newFilePath}
              onChange={(e) => setNewFilePath(e.target.value)}
              required
              autoFocus
            />
            <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: 4 }}>
              Tip: You can include forward slashes (e.g. <code>components/Button.jsx</code>) to create nested folders automatically.
            </p>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setIsNewFileModalOpen(false);
                setNewFilePath('');
                setTargetFolder('');
              }}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              <Plus size={14} />
              <span>Create File</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* ===================== NEW FOLDER MODAL ===================== */}
      <Modal
        isOpen={isNewFolderModalOpen}
        onClose={() => {
          setIsNewFolderModalOpen(false);
          setNewFolderName('');
          setFolderParent('');
        }}
        title="Create New Folder"
      >
        <form onSubmit={handleCreateFolder}>
          {folderParent && (
            <div style={{
              background: '#111419',
              border: '1px solid var(--border-color)',
              padding: '8px 12px',
              borderRadius: 'var(--radius-sm)',
              marginBottom: 14,
              fontSize: '0.82rem',
              color: 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}>
              <Folder size={14} style={{ color: '#e3b341' }} />
              <span>Parent Directory: <strong style={{ color: 'var(--accent-blue)' }}>{folderParent}/</strong></span>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Folder Name or Path *</label>
            <input
              type="text"
              className="input-text"
              placeholder="e.g. components or src/utils"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              required
              autoFocus
            />
            <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: 4 }}>
              Creates a directory folder in your project repository with an initial placeholder.
            </p>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setIsNewFolderModalOpen(false);
                setNewFolderName('');
                setFolderParent('');
              }}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" style={{ background: '#388bfd' }}>
              <FolderPlus size={14} />
              <span>Create Folder</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* ===================== COMMIT TO GITHUB MODAL ===================== */}
      <Modal
        isOpen={isCommitModalOpen}
        onClose={() => {
          setIsCommitModalOpen(false);
          setCommitSuccess(null);
          setCommitError(null);
        }}
        title="Commit to GitHub Repository"
      >
        {commitSuccess ? (
          <div>
            <div style={{
              background: commitSuccess.live ? 'var(--accent-green-bg)' : 'var(--accent-amber-bg)',
              color: commitSuccess.live ? 'var(--accent-green)' : 'var(--accent-amber)',
              border: `1px solid ${commitSuccess.live ? 'rgba(63, 185, 80, 0.4)' : 'rgba(210, 153, 34, 0.4)'}`,
              padding: '14px',
              borderRadius: 'var(--radius-sm)',
              marginBottom: 16
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, fontSize: '0.95rem', marginBottom: 4 }}>
                <CheckCircle2 size={18} />
                <span>{commitSuccess.live ? 'Pushed Live to GitHub.com Successfully!' : 'Simulated Commit Registered (Project Feed Only)'}</span>
              </div>
              <p style={{ fontSize: '0.84rem', margin: 0, lineHeight: 1.4 }}>
                {commitSuccess.live
                  ? `Your commit has been written directly to github.com/${linkedRepo?.owner}/${linkedRepo?.name} on branch ${commitSuccess.branch}.`
                  : 'Commit cryptographic hash registered locally in the project feed. (To push live to github.com, enter a GitHub Personal Access Token with repo scope).'}
              </p>
            </div>

            <div style={{
              background: '#111419',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-sm)',
              padding: '14px',
              fontSize: '0.85rem',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              marginBottom: 20
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-dim)' }}>Status:</span>
                <span style={{ fontWeight: 600, color: commitSuccess.live ? 'var(--accent-green)' : 'var(--accent-amber)' }}>
                  {commitSuccess.live ? '🟢 Live on GitHub.com' : '🟡 Simulated (Feed Only)'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-dim)' }}>File:</span>
                <span style={{ fontWeight: 600 }}>{commitSuccess.filePath}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-dim)' }}>Branch:</span>
                <span style={{ color: 'var(--accent-blue)', fontWeight: 600 }}>{commitSuccess.branch}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-dim)' }}>Commit Message:</span>
                <span style={{ fontStyle: 'italic' }}>"{commitSuccess.message}"</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-dim)' }}>Commit SHA:</span>
                <code style={{ color: 'var(--accent-purple)' }}>{commitSuccess.sha?.slice(0, 10)}</code>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              {commitSuccess.url && commitSuccess.live && (
                <a
                  href={commitSuccess.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-secondary"
                  style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <ExternalLink size={14} />
                  <span>View Commit on GitHub</span>
                </a>
              )}
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  setIsCommitModalOpen(false);
                  setCommitSuccess(null);
                }}
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleCommitToGitHub}>
            {commitError && (
              <div style={{
                background: 'var(--accent-red-bg)',
                color: 'var(--accent-red)',
                border: '1px solid rgba(248, 81, 73, 0.4)',
                padding: '10px 14px',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.85rem',
                marginBottom: 16,
                display: 'flex',
                alignItems: 'center',
                gap: 8
              }}>
                <AlertCircle size={16} />
                <span>{commitError}</span>
              </div>
            )}

            {/* Linked Repository & File Summary */}
            <div style={{
              background: '#111419',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-sm)',
              padding: '12px 14px',
              fontSize: '0.82rem',
              marginBottom: 16,
              display: 'flex',
              flexDirection: 'column',
              gap: 6
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <GithubIcon size={14} />
                  <span>Linked Repository:</span>
                </span>
                <strong style={{ color: 'var(--accent-blue)' }}>
                  {linkedRepo ? `${linkedRepo.owner}/${linkedRepo.name}` : 'No repo linked (Go to GitHub tab to link)'}
                </strong>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <FileCode size={14} />
                  <span>Document to Commit:</span>
                </span>
                <strong style={{ color: 'var(--text-main)' }}>
                  {activeDoc ? activeDoc.file_path : 'None'}
                </strong>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Commit Message *</label>
              <textarea
                className="input-textarea"
                rows={2}
                placeholder="e.g. feat: implement real-time collaborative code editor"
                value={commitMessage}
                onChange={(e) => setCommitMessage(e.target.value)}
                required
                autoFocus
              />
            </div>

            <div className="form-group">
              <label className="form-label">Target Branch</label>
              <input
                type="text"
                className="input-text"
                placeholder="main"
                value={commitBranch}
                onChange={(e) => setCommitBranch(e.target.value)}
              />
            </div>

            {/* Live Push Credentials Section */}
            <div style={{
              background: '#111419',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-sm)',
              padding: '14px',
              marginBottom: 16
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <label className="form-label" style={{ margin: 0, fontSize: '0.82rem', fontWeight: 600 }}>
                  GitHub Personal Access Token (for live push)
                </label>
                <a
                  href="https://github.com/settings/tokens/new?scopes=repo&description=DevCollab"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: 'var(--accent-blue)', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                >
                  <span>Generate Token on GitHub</span>
                  <ExternalLink size={11} />
                </a>
              </div>

              <input
                type="password"
                className="input-text"
                placeholder="ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                value={personalAccessToken}
                onChange={(e) => setPersonalAccessToken(e.target.value)}
                autoComplete="off"
                disabled={simulateOnly}
              />

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.74rem', color: 'var(--text-dim)', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={rememberPat}
                    onChange={(e) => setRememberPat(e.target.checked)}
                    disabled={simulateOnly}
                  />
                  <span>Save token on this browser for future commits</span>
                </label>
              </div>

              <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border-color)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', color: 'var(--text-muted)', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={simulateOnly}
                    onChange={(e) => setSimulateOnly(e.target.checked)}
                  />
                  <span>Simulate in DevCollab project feed only (do not push to github.com)</span>
                </label>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setIsCommitModalOpen(false)}
                disabled={isCommitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isCommitting || !commitMessage.trim()}
                style={{ background: '#238636', borderColor: 'rgba(240, 246, 252, 0.1)' }}
              >
                <GitCommit size={15} />
                <span>{isCommitting ? 'Pushing Commit...' : (simulateOnly ? 'Record Simulated Commit' : 'Push Commit to GitHub.com')}</span>
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
