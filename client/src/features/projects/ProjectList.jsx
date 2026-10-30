import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import Badge from '../../components/Badge';
import { Search, Plus, Users, Lock, Globe, DollarSign, HeartHandshake, Code } from 'lucide-react';
import ProjectCreateModal from './ProjectCreateModal';

export default function ProjectList({ onSelectProject, currentUser, onOpenAuth }) {
  const [projects, setProjects] = useState([]);
  const [search, setSearch] = useState('');
  const [collabFilter, setCollabFilter] = useState('');
  const [techFilter, setTechFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  useEffect(() => {
    loadProjects();
  }, [search, collabFilter, techFilter]);

  async function loadProjects() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (collabFilter) params.append('collaboration_type', collabFilter);
      if (techFilter) params.append('technology', techFilter);

      const res = await api.get(`/projects?${params.toString()}`);
      setProjects(res.projects || []);
    } catch (err) {
      console.error('Failed to load projects:', err);
    } finally {
      setLoading(false);
    }
  }

  function handleCreateClick() {
    if (!currentUser) {
      onOpenAuth();
    } else {
      setIsCreateOpen(true);
    }
  }

  return (
    <div>
      {/* Header & Action */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 700, marginBottom: 4 }}>Explore Projects</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Discover active repositories, join collaborative engineering workspaces, and contribute.
          </p>
        </div>

        <button className="btn btn-primary" onClick={handleCreateClick}>
          <Plus size={16} />
          <span>New Project</span>
        </button>
      </div>

      {/* Search & Filter Bar */}
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
            placeholder="Search projects by title or description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div style={{ width: '180px' }}>
          <select
            className="input-select"
            value={collabFilter}
            onChange={(e) => setCollabFilter(e.target.value)}
          >
            <option value="">All Collaboration Types</option>
            <option value="free">Free / Open-Source</option>
            <option value="paid">Paid Collaboration</option>
          </select>
        </div>

        <div style={{ width: '180px' }}>
          <select
            className="input-select"
            value={techFilter}
            onChange={(e) => setTechFilter(e.target.value)}
          >
            <option value="">All Technologies</option>
            <option value="React">React.js</option>
            <option value="Node">Node.js</option>
            <option value="PostgreSQL">PostgreSQL</option>
            <option value="TypeScript">TypeScript</option>
            <option value="Docker">Docker</option>
          </select>
        </div>
      </div>

      {/* Projects Grid */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
          Loading projects...
        </div>
      ) : projects.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '60px 20px' }}>
          <Code size={36} style={{ color: 'var(--text-dim)', marginBottom: 12 }} />
          <h3 style={{ fontSize: '1.1rem', marginBottom: 6 }}>No projects match your criteria</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginBottom: 16 }}>
            Try adjusting your search terms or create the first project in this workspace.
          </p>
          <button className="btn btn-primary btn-sm" onClick={handleCreateClick}>
            Create Project
          </button>
        </div>
      ) : (
        <div className="grid-2">
          {projects.map((p) => (
            <div
              key={p.id}
              className="card"
              style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
              onClick={() => onSelectProject(p.id)}
            >
              <div>
                {/* Badges & Meta */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Badge variant={p.visibility === 'public' ? 'green' : 'amber'}>
                      {p.visibility === 'public' ? <Globe size={12} /> : <Lock size={12} />}
                      <span style={{ textTransform: 'capitalize' }}>{p.visibility}</span>
                    </Badge>

                    <Badge variant={p.collaboration_type === 'paid' ? 'purple' : 'blue'}>
                      {p.collaboration_type === 'paid' ? <DollarSign size={12} /> : <HeartHandshake size={12} />}
                      <span>{p.collaboration_type === 'paid' ? 'Paid Milestone' : 'Free Collab'}</span>
                    </Badge>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--text-dim)', fontSize: '0.8rem' }}>
                    <Users size={13} />
                    <span>{p.member_count || 1} members</span>
                  </div>
                </div>

                {/* Title & Desc */}
                <h3 style={{ fontSize: '1.15rem', fontWeight: 600, color: 'var(--accent-blue)', marginBottom: 8 }}>
                  {p.title}
                </h3>
                <p style={{
                  color: 'var(--text-muted)',
                  fontSize: '0.88rem',
                  lineHeight: 1.5,
                  marginBottom: 16,
                  display: '-webkit-box',
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden'
                }}>
                  {p.description || 'No description provided.'}
                </p>
              </div>

              <div>
                {/* Tech Tags */}
                {Array.isArray(p.technologies) && p.technologies.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
                    {p.technologies.map((t, idx) => (
                      <span
                        key={idx}
                        style={{
                          background: '#21262d',
                          border: '1px solid var(--border-color)',
                          color: 'var(--text-main)',
                          fontSize: '0.74rem',
                          padding: '2px 8px',
                          borderRadius: '4px'
                        }}
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                )}

                {/* Footer Owner */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingTop: 10,
                  borderTop: '1px solid var(--border-color)',
                  fontSize: '0.8rem',
                  color: 'var(--text-dim)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <img
                      src={p.owner_avatar || 'https://api.dicebear.com/7.x/bottts/svg?seed=owner'}
                      alt={p.owner_name}
                      style={{ width: 20, height: 20, borderRadius: '50%' }}
                    />
                    <span>{p.owner_name}</span>
                  </div>
                  <span>{new Date(p.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      <ProjectCreateModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onProjectCreated={(newProject) => {
          loadProjects();
          onSelectProject(newProject.id);
        }}
      />
    </div>
  );
}
