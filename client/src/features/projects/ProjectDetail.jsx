import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import Badge from '../../components/Badge';
import Modal from '../../components/Modal';
import CollaborativeEditor from '../editor/CollaborativeEditor';
import TaskBoard from '../tasks/TaskBoard';
import ReviewManager from '../reviews/ReviewManager';
import GitHubPanel from '../github/GitHubPanel';
import CollaborationOffers from '../collaboration/CollaborationOffers';
import {
  ArrowLeft, Code, CheckSquare, GitPullRequest, GitBranch,
  DollarSign, Users, Globe, Lock, UserPlus, Settings, Shield, UserCheck
} from 'lucide-react';

export default function ProjectDetail({ projectId, onBack, currentUser, onOpenAuth }) {
  const [project, setProject] = useState(null);
  const [activeSubTab, setActiveSubTab] = useState('editor'); // 'overview', 'editor', 'tasks', 'reviews', 'github', 'collab'
  const [loading, setLoading] = useState(true);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);

  // Invite form
  const [inviteUserId, setInviteUserId] = useState('');
  const [inviteRole, setInviteRole] = useState('contributor');
  const [availableUsers, setAvailableUsers] = useState([]);

  // Collaboration request form (for non-members)
  const [isCollabRequestOpen, setIsCollabRequestOpen] = useState(false);
  const [requestRole, setRequestRole] = useState('contributor');
  const [requestPitch, setRequestPitch] = useState('');
  const [requestSubmitting, setRequestSubmitting] = useState(false);

  useEffect(() => {
    loadProject();
  }, [projectId]);

  async function loadProject() {
    setLoading(true);
    try {
      const res = await api.get(`/projects/${projectId}`);
      setProject(res.project);
    } catch (err) {
      console.error('Failed to load project details:', err);
    } finally {
      setLoading(false);
    }
  }

  async function openInviteModal() {
    try {
      const res = await api.get('/users?limit=50');
      // Filter out existing members
      const existingIds = new Set((project?.members || []).map(m => m.user_id));
      const notMembers = (res.users || []).filter(u => !existingIds.has(u.id));
      setAvailableUsers(notMembers);
      setIsInviteModalOpen(true);
    } catch (err) {
      console.error('Failed to fetch users for invitation:', err);
    }
  }

  async function handleInviteMember(e) {
    e.preventDefault();
    if (!inviteUserId) return;

    try {
      await api.post(`/projects/${projectId}/members`, {
        userId: inviteUserId,
        role: inviteRole
      });
      setIsInviteModalOpen(false);
      setInviteUserId('');
      await loadProject();
    } catch (err) {
      alert(err.message || 'Failed to invite member');
    }
  }

  async function handleUpdateMemberRole(memberUserId, newRole) {
    try {
      await api.put(`/projects/${projectId}/members/${memberUserId}`, { role: newRole });
      await loadProject();
    } catch (err) {
      alert(err.message || 'Failed to update member role');
    }
  }

  async function handleRemoveMember(memberUserId) {
    if (!confirm('Are you sure you want to remove this member from the project?')) return;
    try {
      await api.delete(`/projects/${projectId}/members/${memberUserId}`);
      await loadProject();
    } catch (err) {
      alert(err.message || 'Failed to remove member');
    }
  }

  async function handleSendCollabRequest(e) {
    e.preventDefault();
    if (!requestPitch.trim()) return;

    setRequestSubmitting(true);
    try {
      await api.post(`/collaborations/projects/${projectId}/requests`, {
        role: requestRole,
        pitch: requestPitch.trim()
      });
      setIsCollabRequestOpen(false);
      setRequestPitch('');
      alert('Collaboration request submitted to project owner!');
    } catch (err) {
      alert(err.message || 'Failed to submit collaboration request');
    } finally {
      setRequestSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--text-muted)' }}>
        Loading project workspace...
      </div>
    );
  }

  if (!project) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '60px 20px' }}>
        <h3 style={{ marginBottom: 12 }}>Project Not Found</h3>
        <button className="btn btn-secondary" onClick={onBack}>
          <ArrowLeft size={16} /> Back to Projects
        </button>
      </div>
    );
  }

  const isOwner = currentUser && project.owner_id === currentUser.id;
  const currentRole = project.currentUserRole || (isOwner ? 'owner' : null);

  return (
    <div>
      {/* Top Header Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <button className="btn btn-secondary btn-sm" onClick={onBack}>
          <ArrowLeft size={14} />
          <span>Back to Projects</span>
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Badge variant={project.visibility === 'public' ? 'green' : 'amber'}>
            {project.visibility === 'public' ? <Globe size={12} /> : <Lock size={12} />}
            <span style={{ textTransform: 'capitalize' }}>{project.visibility}</span>
          </Badge>

          <Badge variant={project.collaboration_type === 'paid' ? 'purple' : 'blue'}>
            <DollarSign size={12} />
            <span>{project.collaboration_type === 'paid' ? 'Paid Milestone' : 'Free Collab'}</span>
          </Badge>

          {currentRole && (
            <Badge variant="blue">
              <Shield size={12} />
              <span>Your Role: {currentRole.toUpperCase()}</span>
            </Badge>
          )}
        </div>
      </div>

      {/* Project Title Banner */}
      <div className="card" style={{ padding: '20px', marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ fontSize: '1.6rem', fontWeight: 700, marginBottom: 6, color: 'var(--text-main)' }}>
              {project.title}
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', maxWidth: '850px', lineHeight: 1.5, marginBottom: 12 }}>
              {project.description || 'Collaborative workspace repository.'}
            </p>

            {/* Technologies */}
            {Array.isArray(project.technologies) && project.technologies.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {project.technologies.map((t, idx) => (
                  <span
                    key={idx}
                    style={{
                      background: '#21262d',
                      border: '1px solid var(--border-color)',
                      color: 'var(--text-main)',
                      fontSize: '0.75rem',
                      padding: '2px 8px',
                      borderRadius: '4px'
                    }}
                  >
                    {t}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Members / Invite button / Request to Collaborate */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {isOwner && (
              <button className="btn btn-outline-blue btn-sm" onClick={openInviteModal}>
                <UserPlus size={14} />
                <span>Invite Member</span>
              </button>
            )}

            {currentUser && !isOwner && !currentRole && (
              <button className="btn btn-primary btn-sm" onClick={() => setIsCollabRequestOpen(true)}>
                <UserCheck size={14} />
                <span>Request to Collaborate</span>
              </button>
            )}

            {!currentUser && (
              <button className="btn btn-primary btn-sm" onClick={onOpenAuth}>
                <UserCheck size={14} />
                <span>Sign In to Collaborate</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Project Workspace Navigation Tabs */}
      <div className="tabs">
        <button
          className={`tab-btn ${activeSubTab === 'editor' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('editor')}
        >
          <Code size={16} />
          <span>Code Editor (Monaco)</span>
        </button>

        <button
          className={`tab-btn ${activeSubTab === 'tasks' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('tasks')}
        >
          <CheckSquare size={16} />
          <span>Tasks & Milestones</span>
        </button>

        <button
          className={`tab-btn ${activeSubTab === 'reviews' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('reviews')}
        >
          <GitPullRequest size={16} />
          <span>Code Reviews</span>
        </button>

        <button
          className={`tab-btn ${activeSubTab === 'github' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('github')}
        >
          <GitBranch size={16} />
          <span>GitHub & Webhooks</span>
        </button>

        <button
          className={`tab-btn ${activeSubTab === 'collab' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('collab')}
        >
          <DollarSign size={16} />
          <span>Agreements & Ledger</span>
        </button>

        <button
          className={`tab-btn ${activeSubTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('overview')}
        >
          <Users size={16} />
          <span>Members & Access ({project.members?.length || 1})</span>
        </button>
      </div>

      {/* Tab Panels */}
      {activeSubTab === 'editor' && (
        <CollaborativeEditor
          projectId={project.id}
          projectRole={currentRole || 'viewer'}
          currentUser={currentUser}
        />
      )}

      {activeSubTab === 'tasks' && (
        <TaskBoard
          projectId={project.id}
          projectMembers={project.members || []}
          currentUser={currentUser}
          canManageTasks={['owner', 'contributor', 'reviewer'].includes(currentRole)}
        />
      )}

      {activeSubTab === 'reviews' && (
        <ReviewManager
          projectId={project.id}
          projectRole={currentRole || 'viewer'}
          currentUser={currentUser}
        />
      )}

      {activeSubTab === 'github' && (
        <GitHubPanel
          projectId={project.id}
          projectRole={currentRole || 'viewer'}
          isOwner={isOwner}
        />
      )}

      {activeSubTab === 'collab' && (
        <CollaborationOffers
          projectId={project.id}
          projectMembers={project.members || []}
          currentUser={currentUser}
          isOwner={isOwner}
          viewMode="project"
        />
      )}

      {activeSubTab === 'overview' && (
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Project Members & Permissions (RBAC)</h3>
            {isOwner && (
              <button className="btn btn-primary btn-sm" onClick={openInviteModal}>
                <UserPlus size={14} /> Invite New Member
              </button>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {project.members?.map((m) => (
              <div
                key={m.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 14px',
                  background: '#161b22',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-sm)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <img
                    src={m.avatar_url || 'https://api.dicebear.com/7.x/bottts/svg?seed=user'}
                    alt={m.name}
                    style={{ width: 32, height: 32, borderRadius: '50%' }}
                  />
                  <div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>{m.name}</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>
                      Joined {new Date(m.joined_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {isOwner && m.user_id !== project.owner_id ? (
                    <select
                      className="input-select"
                      style={{ width: 140, padding: '4px 8px', fontSize: '0.8rem' }}
                      value={m.role}
                      onChange={(e) => handleUpdateMemberRole(m.user_id, e.target.value)}
                    >
                      <option value="contributor">Contributor</option>
                      <option value="reviewer">Reviewer</option>
                      <option value="viewer">Viewer (Read-only)</option>
                    </select>
                  ) : (
                    <Badge variant={m.role === 'owner' ? 'purple' : m.role === 'reviewer' ? 'blue' : 'green'}>
                      {m.role.toUpperCase()}
                    </Badge>
                  )}

                  {isOwner && m.user_id !== project.owner_id && (
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => handleRemoveMember(m.user_id)}
                      title="Remove member"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Invite Member Modal */}
      <Modal isOpen={isInviteModalOpen} onClose={() => setIsInviteModalOpen(false)} title="Invite Developer to Project">
        <form onSubmit={handleInviteMember}>
          <div className="form-group">
            <label className="form-label">Select Developer *</label>
            <select
              className="input-select"
              value={inviteUserId}
              onChange={(e) => setInviteUserId(e.target.value)}
              required
            >
              <option value="">Choose a developer from directory...</option>
              {availableUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.email})
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Role & Permissions *</label>
            <select
              className="input-select"
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value)}
            >
              <option value="contributor">Contributor (Can edit code, create tasks)</option>
              <option value="reviewer">Reviewer (Can review code, suggest changes)</option>
              <option value="viewer">Viewer (Read-only code editor access)</option>
            </select>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
            <button type="button" className="btn btn-secondary" onClick={() => setIsInviteModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Add Member
            </button>
          </div>
        </form>
      </Modal>

      {/* Collaboration Request Modal (for non-members) */}
      <Modal
        isOpen={isCollabRequestOpen}
        onClose={() => setIsCollabRequestOpen(false)}
        title={`Request to Collaborate on "${project.title}"`}
      >
        <form onSubmit={handleSendCollabRequest}>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginBottom: 14 }}>
            Introduce yourself to the project owner (<strong>{project.owner_name}</strong>) and explain what you can bring to this workspace.
          </p>

          <div className="form-group">
            <label className="form-label">Desired Role</label>
            <select
              className="input-select"
              value={requestRole}
              onChange={(e) => setRequestRole(e.target.value)}
            >
              <option value="contributor">Contributor (Code editing, task delivery)</option>
              <option value="reviewer">Reviewer (Code inspections, PR feedback)</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Your Contribution Pitch / Experience *</label>
            <textarea
              className="input-textarea"
              placeholder="Highlight your technical skills, relevant repos or projects, and what part of this codebase you would like to work on..."
              value={requestPitch}
              onChange={(e) => setRequestPitch(e.target.value)}
              rows={4}
              required
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsCollabRequestOpen(false)}
              disabled={requestSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={requestSubmitting}
            >
              <UserCheck size={14} />
              <span>{requestSubmitting ? 'Sending Request...' : 'Submit Collaboration Request'}</span>
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
