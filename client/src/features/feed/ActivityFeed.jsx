import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import Badge from '../../components/Badge';
import { Activity, GitCommit, GitPullRequest, CheckCircle2, FolderGit2, RefreshCw } from 'lucide-react';

export default function ActivityFeed({ onSelectProject }) {
  const [feed, setFeed] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFeed();
  }, []);

  async function loadFeed() {
    setLoading(true);
    try {
      const res = await api.get('/projects/feed');
      setFeed(res.feed || []);
    } catch (err) {
      console.error('Failed to load activity feed:', err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 700, marginBottom: 4 }}>Platform Activity Feed</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Live updates across engineering workspaces, GitHub webhook events, code review decisions, and project milestones.
          </p>
        </div>

        <button className="btn btn-secondary btn-sm" onClick={loadFeed} disabled={loading}>
          <RefreshCw size={14} className={loading ? 'spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>Loading live feed...</div>
      ) : feed.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-dim)' }}>
          No platform activities recorded yet.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {feed.map((item) => {
            const isGithub = item.type === 'GITHUB_EVENT';

            return (
              <div
                key={item.id}
                className="card"
                style={{
                  padding: '16px 20px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 14,
                  cursor: item.project_id ? 'pointer' : 'default'
                }}
                onClick={() => item.project_id && onSelectProject(item.project_id)}
              >
                <div style={{
                  background: isGithub ? 'var(--accent-blue-bg)' : 'var(--accent-green-bg)',
                  color: isGithub ? 'var(--accent-blue)' : 'var(--accent-green)',
                  padding: '10px',
                  borderRadius: 'var(--radius-sm)',
                  marginTop: 2
                }}>
                  {isGithub ? <GitCommit size={18} /> : <CheckCircle2 size={18} />}
                </div>

                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4, flexWrap: 'wrap', gap: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 600, fontSize: '0.92rem', color: 'var(--text-main)' }}>
                        {item.title}
                      </span>
                      {item.project_title && (
                        <Badge variant="blue">{item.project_title}</Badge>
                      )}
                    </div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                      {new Date(item.timestamp).toLocaleString()}
                    </span>
                  </div>

                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                    {typeof item.description === 'string'
                      ? item.description
                      : JSON.stringify(item.description)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
