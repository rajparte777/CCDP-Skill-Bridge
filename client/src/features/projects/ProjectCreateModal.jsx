import React, { useState } from 'react';
import Modal from '../../components/Modal';
import { api } from '../../services/api';
import { Plus, FolderGit2 } from 'lucide-react';

export default function ProjectCreateModal({ isOpen, onClose, onProjectCreated }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState('public');
  const [collaborationType, setCollaborationType] = useState('free');
  const [techInput, setTechInput] = useState('React.js, Node.js, PostgreSQL');
  const [repoUrl, setRepoUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim()) return;

    setError(null);
    setLoading(true);

    try {
      const technologies = techInput.split(',').map(t => t.trim()).filter(Boolean);
      const res = await api.post('/projects', {
        title,
        description,
        visibility,
        collaboration_type: collaborationType,
        technologies,
        repository_url: repoUrl
      });

      onProjectCreated(res.project);
      onClose();
      // Reset
      setTitle('');
      setDescription('');
    } catch (err) {
      if (err.status === 401) {
        setError(err.message ? `Authentication notice: ${err.message}` : 'Your session may have expired. Please sign in again.');
      } else {
        setError(err.message || 'Failed to create project');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create New Project">
      {error && (
        <div style={{
          background: 'var(--accent-red-bg)',
          color: 'var(--accent-red)',
          padding: '10px 14px',
          borderRadius: 'var(--radius-sm)',
          fontSize: '0.85rem',
          marginBottom: 16
        }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label className="form-label">Project Title *</label>
          <input
            type="text"
            className="input-text"
            placeholder="e.g. Real-Time Distributed File Synchronizer"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </div>

        <div className="form-group">
          <label className="form-label">Description</label>
          <textarea
            className="input-textarea"
            placeholder="Overview of project goals, architecture, and expected contribution scope..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div className="form-group">
            <label className="form-label">Visibility</label>
            <select
              className="input-select"
              value={visibility}
              onChange={(e) => setVisibility(e.target.value)}
            >
              <option value="public">Public (Visible to everyone)</option>
              <option value="private">Private (Members only)</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Collaboration Agreement</label>
            <select
              className="input-select"
              value={collaborationType}
              onChange={(e) => setCollaborationType(e.target.value)}
            >
              <option value="free">Free / Open-Source (Unpaid)</option>
              <option value="paid">Paid Collaboration (Milestone Terms)</option>
            </select>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Technologies (comma separated)</label>
          <input
            type="text"
            className="input-text"
            placeholder="React, Node.js, WebSockets, Docker"
            value={techInput}
            onChange={(e) => setTechInput(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label className="form-label">GitHub Repository URL (Optional)</label>
          <input
            type="url"
            className="input-text"
            placeholder="https://github.com/owner/repo"
            value={repoUrl}
            onChange={(e) => setRepoUrl(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            <Plus size={16} />
            <span>{loading ? 'Creating...' : 'Create Project'}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
}
