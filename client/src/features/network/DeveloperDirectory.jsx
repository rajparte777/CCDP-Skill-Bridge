import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import Badge from '../../components/Badge';
import { Search, UserPlus, Users, Check, X, Globe, Clock, CheckCircle2 } from 'lucide-react';

function GithubIcon({ size = 12 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
      <path d="M9 18c-4.51 2-5-2-7-2" />
    </svg>
  );
}

export default function DeveloperDirectory({ currentUser, onOpenAuth }) {
  const [activeTab, setActiveTab] = useState('directory'); // 'directory', 'connections'
  const [developers, setDevelopers] = useState([]);
  const [connections, setConnections] = useState([]);
  const [pendingReceived, setPendingReceived] = useState([]);
  const [pendingSent, setPendingSent] = useState([]);
  const [search, setSearch] = useState('');
  const [skillFilter, setSkillFilter] = useState('');
  const [skillsList, setSkillsList] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSkills();
    loadDevelopers();
    if (currentUser) {
      loadMyConnections();
    }
  }, [search, skillFilter, currentUser]);

  async function loadSkills() {
    try {
      const res = await api.get('/users/skills');
      setSkillsList(res.skills || []);
    } catch (err) {
      console.error('Failed to load skills:', err);
    }
  }

  async function loadDevelopers() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (skillFilter) params.append('skill', skillFilter);

      const res = await api.get(`/users?${params.toString()}`);
      setDevelopers(res.users || []);
    } catch (err) {
      console.error('Failed to load developers:', err);
    } finally {
      setLoading(false);
    }
  }

  async function loadMyConnections() {
    try {
      const res = await api.get('/connections');
      setConnections(res.connections || []);
      setPendingReceived(res.pendingReceived || []);
      setPendingSent(res.pendingSent || []);
    } catch (err) {
      console.error('Failed to load connections:', err);
    }
  }

  async function handleSendRequest(receiverId) {
    if (!currentUser) {
      onOpenAuth();
      return;
    }

    try {
      await api.post('/connections/request', { receiverId });
      await loadMyConnections();
      alert('Connection request sent!');
    } catch (err) {
      alert(err.message || 'Failed to send request');
    }
  }

  async function handleRespond(connectionId, action) {
    try {
      await api.put(`/connections/${connectionId}/respond`, { action });
      await loadMyConnections();
    } catch (err) {
      alert(err.message || 'Failed to respond to request');
    }
  }

  const connectedIds = new Set(connections.map(c => c.user_id));
  const pendingSentIds = new Set(pendingSent.map(p => p.user_id));

  return (
    <div>
      {/* Top Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 700, marginBottom: 4 }}>Developer Networking</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Discover talented engineers, connect over shared technical stacks, and form project teams.
          </p>
        </div>

        {currentUser && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className={`btn ${activeTab === 'directory' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
              onClick={() => setActiveTab('directory')}
            >
              <Users size={14} /> Directory
            </button>
            <button
              className={`btn ${activeTab === 'connections' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
              onClick={() => {
                setActiveTab('connections');
                loadMyConnections();
              }}
            >
              <CheckCircle2 size={14} /> My Connections ({connections.length})
              {pendingReceived.length > 0 && (
                <span style={{ background: 'var(--accent-red)', color: '#fff', padding: '1px 5px', borderRadius: '10px', fontSize: '0.7rem' }}>
                  {pendingReceived.length}
                </span>
              )}
            </button>
          </div>
        )}
      </div>

      {activeTab === 'directory' ? (
        <>
          {/* Search & Filter */}
          <div style={{
            display: 'flex',
            gap: 12,
            marginBottom: 24,
            flexWrap: 'wrap',
            background: 'var(--bg-card)',
            padding: '14px 16px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-color)'
          }}>
            <div style={{ flex: '1 1 250px', position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--text-dim)' }} />
              <input
                type="text"
                className="input-text"
                style={{ paddingLeft: 36 }}
                placeholder="Search developers by name or bio..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div style={{ width: '220px' }}>
              <select
                className="input-select"
                value={skillFilter}
                onChange={(e) => setSkillFilter(e.target.value)}
              >
                <option value="">Filter by Skill</option>
                {skillsList.map((s) => (
                  <option key={s.id} value={s.name}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Developers Grid */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>Loading developers...</div>
          ) : developers.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-dim)' }}>
              No developers found matching your criteria.
            </div>
          ) : (
            <div className="grid-3">
              {developers.map((dev) => {
                const isMe = currentUser?.id === dev.id;
                const isConnected = connectedIds.has(dev.id);
                const isPending = pendingSentIds.has(dev.id);

                return (
                  <div key={dev.id} className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div>
                      {/* Avatar & Info */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                        <img
                          src={dev.avatar_url || 'https://api.dicebear.com/7.x/bottts/svg?seed=u'}
                          alt={dev.name}
                          style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--border-color)' }}
                        />
                        <div>
                          <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>{dev.name}</h3>
                          {dev.github_username && (
                            <div style={{ fontSize: '0.78rem', color: 'var(--accent-blue)', display: 'flex', alignItems: 'center', gap: 4 }}>
                              <GithubIcon size={12} />
                              <span>@{dev.github_username}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <p style={{
                        fontSize: '0.85rem',
                        color: 'var(--text-muted)',
                        marginBottom: 14,
                        lineHeight: 1.4,
                        display: '-webkit-box',
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden'
                      }}>
                        {dev.bio || 'Passionate software engineer.'}
                      </p>

                      {/* Skills */}
                      {Array.isArray(dev.skills) && dev.skills.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 16 }}>
                          {dev.skills.map((s) => (
                            <span
                              key={s.id}
                              style={{
                                background: '#21262d',
                                border: '1px solid var(--border-color)',
                                color: 'var(--text-main)',
                                fontSize: '0.72rem',
                                padding: '2px 7px',
                                borderRadius: '4px'
                              }}
                            >
                              {s.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Action */}
                    <div style={{ paddingTop: 12, borderTop: '1px solid var(--border-color)' }}>
                      {isMe ? (
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontStyle: 'italic' }}>
                          This is your profile
                        </span>
                      ) : isConnected ? (
                        <span style={{ color: 'var(--accent-green)', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 5, fontWeight: 500 }}>
                          <CheckCircle2 size={14} /> Connected
                        </span>
                      ) : isPending ? (
                        <span style={{ color: 'var(--accent-amber)', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 5 }}>
                          <Clock size={14} /> Request Pending
                        </span>
                      ) : (
                        <button
                          className="btn btn-secondary btn-sm"
                          style={{ width: '100%' }}
                          onClick={() => handleSendRequest(dev.id)}
                        >
                          <UserPlus size={14} /> Connect
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      ) : (
        /* My Connections Tab */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Pending Received */}
          {pendingReceived.length > 0 && (
            <div className="card" style={{ padding: '18px' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 12, color: 'var(--accent-amber)' }}>
                Incoming Connection Requests ({pendingReceived.length})
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {pendingReceived.map((req) => (
                  <div
                    key={req.connection_id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      background: '#161b22',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-sm)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <img src={req.avatar_url || 'https://api.dicebear.com/7.x/bottts/svg?seed=u'} alt="" style={{ width: 34, height: 34, borderRadius: '50%' }} />
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{req.name}</div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>{req.bio || 'Software developer'}</div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn btn-primary btn-sm" onClick={() => handleRespond(req.connection_id, 'accepted')}>
                        <Check size={14} /> Accept
                      </button>
                      <button className="btn btn-secondary btn-sm" onClick={() => handleRespond(req.connection_id, 'rejected')}>
                        <X size={14} /> Ignore
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Active Connections */}
          <div className="card" style={{ padding: '18px' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 14 }}>
              Active Connections ({connections.length})
            </h3>

            {connections.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-dim)', fontSize: '0.85rem' }}>
                You have not connected with any developers yet. Browse the Directory to grow your network!
              </div>
            ) : (
              <div className="grid-2">
                {connections.map((c) => (
                  <div
                    key={c.connection_id}
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
                      <img src={c.avatar_url || 'https://api.dicebear.com/7.x/bottts/svg?seed=u'} alt="" style={{ width: 36, height: 36, borderRadius: '50%' }} />
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.92rem' }}>{c.name}</div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>
                          Connected since {new Date(c.connected_since).toLocaleDateString()}
                        </div>
                      </div>
                    </div>

                    <Badge variant="green">Connected</Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
