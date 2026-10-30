import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import Badge from '../../components/Badge';
import Modal from '../../components/Modal';
import { GitBranch, GitCommit, GitPullRequest, ExternalLink, Link2, Radio, CheckCircle2, Play } from 'lucide-react';

export default function GitHubPanel({ projectId, projectRole, isOwner }) {
  const [repository, setRepository] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [isSimulateModalOpen, setIsSimulateModalOpen] = useState(false);

  // Link form
  const [owner, setOwner] = useState('devcollab-org');
  const [repoName, setRepoName] = useState('devcollab-suite');
  const [repoUrl, setRepoUrl] = useState('https://github.com/devcollab-org/devcollab-suite');
  const [defaultBranch, setDefaultBranch] = useState('main');

  // Simulation form
  const [simEventType, setSimEventType] = useState('push');
  const [simMessage, setSimMessage] = useState('Feat: integrate real-time Yjs CRDT synchronizer');
  const [simBranch, setSimBranch] = useState('main');
  const [simulating, setSimulating] = useState(false);

  useEffect(() => {
    loadRepository();
  }, [projectId]);

  async function loadRepository() {
    setLoading(true);
    try {
      const res = await api.get(`/github/projects/${projectId}`);
      setRepository(res.repository);
    } catch (err) {
      if (err.status !== 404) {
        console.error('Failed to load GitHub repository details:', err);
      }
      setRepository(null);
    } finally {
      setLoading(false);
    }
  }

  async function handleLinkRepo(e) {
    e.preventDefault();
    try {
      const res = await api.post(`/github/projects/${projectId}/link`, {
        owner,
        name: repoName,
        url: repoUrl,
        default_branch: defaultBranch
      });
      setRepository(res.repository);
      setIsLinkModalOpen(false);
      loadRepository();
    } catch (err) {
      alert(err.message || 'Failed to link repository');
    }
  }

  async function handleSimulateWebhook(e) {
    e.preventDefault();
    setSimulating(true);
    try {
      await api.post(`/github/projects/${projectId}/simulate`, {
        event_type: simEventType,
        message: simMessage,
        branch: simBranch
      });
      setIsSimulateModalOpen(false);
      await loadRepository();
    } catch (err) {
      alert(err.message || 'Webhook simulation failed');
    } finally {
      setSimulating(false);
    }
  }

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Loading GitHub repository data...</div>;
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>GitHub Repository & Webhook Feed</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Connected repository metadata, commit history, and cryptographic webhook delivery logs.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          {repository && (
            <button className="btn btn-secondary btn-sm" onClick={() => setIsSimulateModalOpen(true)}>
              <Play size={14} style={{ color: 'var(--accent-blue)' }} />
              <span>Simulate Webhook Event</span>
            </button>
          )}

          {isOwner && (
            <button className="btn btn-outline-blue btn-sm" onClick={() => setIsLinkModalOpen(true)}>
              <Link2 size={14} />
              <span>{repository ? 'Re-link Repository' : 'Link GitHub Repository'}</span>
            </button>
          )}
        </div>
      </div>

      {!repository ? (
        <div className="card" style={{ textAlign: 'center', padding: '60px 20px' }}>
          <GitBranch size={40} style={{ color: 'var(--text-dim)', marginBottom: 12 }} />
          <h3 style={{ fontSize: '1.1rem', marginBottom: 6 }}>No GitHub Repository Connected</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', maxWidth: '500px', margin: '0 auto 16px' }}>
            Link a GitHub repository to synchronize commit activity, track pull requests, and receive automated webhook events.
          </p>
          {isOwner && (
            <button className="btn btn-primary btn-sm" onClick={() => setIsLinkModalOpen(true)}>
              <Link2 size={15} /> Link Repository
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Linked Repo Banner */}
          <div className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                background: '#21262d',
                padding: '10px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'center'
              }}>
                <GitBranch size={22} style={{ color: 'var(--accent-blue)' }} />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>{repository.owner} / {repository.name}</h3>
                  <Badge variant="blue">{repository.visibility}</Badge>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: '0.8rem', color: 'var(--text-dim)' }}>
                  <span>Default branch: <code style={{ color: 'var(--text-muted)' }}>{repository.default_branch}</code></span>
                  <span>•</span>
                  <span>Webhook security: <code style={{ color: 'var(--accent-green)' }}>HMAC-SHA256 active</code></span>
                </div>
              </div>
            </div>

            <a
              href={repository.url}
              target="_blank"
              rel="noreferrer"
              className="btn btn-secondary btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <span>View on GitHub</span>
              <ExternalLink size={13} />
            </a>
          </div>

          {/* Webhook Activity Timeline */}
          <div className="card" style={{ padding: '20px' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Radio size={16} style={{ color: 'var(--accent-green)' }} />
              <span>Repository Activity & Webhook Events ({repository.events?.length || 0})</span>
            </h3>

            {(!repository.events || repository.events.length === 0) ? (
              <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-dim)', fontSize: '0.85rem' }}>
                No events recorded yet. Click "Simulate Webhook Event" above to test the cryptographic event pipeline.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {repository.events.map((ev) => {
                  const summary = ev.payload_summary?.summary || 'GitHub repository activity';
                  const isPush = ev.event_type === 'push';

                  return (
                    <div
                      key={ev.id}
                      style={{
                        background: '#161b22',
                        border: '1px solid var(--border-color)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '14px',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 12
                      }}
                    >
                      <div style={{
                        background: isPush ? 'var(--accent-blue-bg)' : 'var(--accent-purple-bg)',
                        color: isPush ? 'var(--accent-blue)' : 'var(--accent-purple)',
                        padding: '8px',
                        borderRadius: '6px',
                        marginTop: 2
                      }}>
                        {isPush ? <GitCommit size={16} /> : <GitPullRequest size={16} />}
                      </div>

                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)' }}>
                            {isPush ? 'Commit Push' : 'Pull Request Event'}
                          </span>
                          <span style={{ fontSize: '0.74rem', color: 'var(--text-dim)' }}>
                            {new Date(ev.occurred_at).toLocaleString()}
                          </span>
                        </div>

                        <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', marginBottom: 6 }}>
                          {summary}
                        </p>

                        <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                          <span>Delivery ID: <code>{ev.delivery_id}</code></span>
                          <span>•</span>
                          <span style={{ color: 'var(--accent-green)', display: 'flex', alignItems: 'center', gap: 3 }}>
                            <CheckCircle2 size={11} /> Verified Idempotent
                          </span>
                          {ev.payload_summary?.commit_sha && (
                            <>
                              <span>•</span>
                              <span>SHA: <code style={{ color: 'var(--accent-purple)' }}>{ev.payload_summary.commit_sha.slice(0, 8)}</code></span>
                            </>
                          )}
                          {ev.payload_summary?.commit_url && (
                            <a
                              href={ev.payload_summary.commit_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ color: 'var(--accent-blue)', display: 'inline-flex', alignItems: 'center', gap: 3 }}
                            >
                              <span>View Commit</span>
                              <ExternalLink size={10} />
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Link Repository Modal */}
      <Modal isOpen={isLinkModalOpen} onClose={() => setIsLinkModalOpen(false)} title="Link GitHub Repository">
        <form onSubmit={handleLinkRepo}>
          <div className="form-group">
            <label className="form-label">Repository Owner / Organization *</label>
            <input
              type="text"
              className="input-text"
              placeholder="e.g. devcollab-org"
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Repository Name *</label>
            <input
              type="text"
              className="input-text"
              placeholder="e.g. distributed-collab"
              value={repoName}
              onChange={(e) => setRepoName(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">GitHub URL *</label>
            <input
              type="url"
              className="input-text"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Default Branch</label>
            <input
              type="text"
              className="input-text"
              value={defaultBranch}
              onChange={(e) => setDefaultBranch(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
            <button type="button" className="btn btn-secondary" onClick={() => setIsLinkModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Connect Repository
            </button>
          </div>
        </form>
      </Modal>

      {/* Simulate Webhook Modal */}
      <Modal isOpen={isSimulateModalOpen} onClose={() => setIsSimulateModalOpen(false)} title="Simulate GitHub Webhook Event">
        <form onSubmit={handleSimulateWebhook}>
          <div className="form-group">
            <label className="form-label">Event Type</label>
            <select className="input-select" value={simEventType} onChange={(e) => setSimEventType(e.target.value)}>
              <option value="push">Push (Commit Activity)</option>
              <option value="pull_request">Pull Request</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Branch</label>
            <input
              type="text"
              className="input-text"
              value={simBranch}
              onChange={(e) => setSimBranch(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Commit / PR Description</label>
            <input
              type="text"
              className="input-text"
              value={simMessage}
              onChange={(e) => setSimMessage(e.target.value)}
              required
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
            <button type="button" className="btn btn-secondary" onClick={() => setIsSimulateModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={simulating}>
              <Play size={14} />
              <span>{simulating ? 'Emitting...' : 'Dispatch Webhook Event'}</span>
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
