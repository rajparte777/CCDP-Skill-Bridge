import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import Badge from '../../components/Badge';
import Modal from '../../components/Modal';
import {
  Globe, Edit3, FolderGit2, Mail, ShieldCheck, User, Lock, Key,
  CheckCircle2, AlertCircle, History, Link2, Eye, EyeOff, Shield
} from 'lucide-react';

function GithubIcon({ size = 15 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
    </svg>
  );
}

export default function ProfileView({ currentUser, onUserUpdated, onSelectProject }) {
  const [activeProfileTab, setActiveProfileTab] = useState('overview'); // 'overview', 'security'
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Edit form state
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [githubUsername, setGithubUsername] = useState('');
  const [portfolioUrl, setPortfolioUrl] = useState('');
  const [skillsStr, setSkillsStr] = useState('');
  const [isPublic, setIsPublic] = useState(true);

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdError, setPwdError] = useState(null);
  const [pwdSuccess, setPwdSuccess] = useState(null);

  // Security logs
  const [securityLogs, setSecurityLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);

  useEffect(() => {
    if (currentUser) {
      loadProfile();
      if (activeProfileTab === 'security') {
        loadSecurityLogs();
      }
    }
  }, [currentUser, activeProfileTab]);

  async function loadProfile() {
    setLoading(true);
    try {
      const res = await api.get(`/users/${currentUser.id}`);
      setProfile(res.profile);
      setBio(res.profile.bio || '');
      setAvatarUrl(res.profile.avatar_url || '');
      setGithubUsername(res.profile.github_username || '');
      setPortfolioUrl(res.profile.portfolio_url || '');
      setSkillsStr((res.profile.skills || []).map(s => s.name).join(', '));
      setIsPublic(Boolean(res.profile.is_public));
    } catch (err) {
      console.error('Failed to load profile:', err);
    } finally {
      setLoading(false);
    }
  }

  async function loadSecurityLogs() {
    setLogsLoading(true);
    try {
      const res = await api.get('/auth/security-logs');
      setSecurityLogs(res.logs || []);
    } catch (err) {
      console.error('Failed to load security logs:', err);
    } finally {
      setLogsLoading(false);
    }
  }

  async function handleUpdateProfile(e) {
    e.preventDefault();
    try {
      const skills = skillsStr.split(',').map(s => s.trim()).filter(Boolean);
      const res = await api.put('/users/profile', {
        bio,
        avatar_url: avatarUrl,
        github_username: githubUsername,
        portfolio_url: portfolioUrl,
        skills,
        is_public: isPublic
      });

      onUserUpdated(res.user);
      setIsEditModalOpen(false);
      loadProfile();
    } catch (err) {
      alert(err.message || 'Failed to update profile');
    }
  }

  async function handleChangePassword(e) {
    e.preventDefault();
    setPwdError(null);
    setPwdSuccess(null);

    if (newPassword !== confirmNewPassword) {
      setPwdError('New passwords do not match.');
      return;
    }

    if (newPassword.length < 8) {
      setPwdError('New password must be at least 8 characters long.');
      return;
    }

    setPwdLoading(true);
    try {
      const res = await api.put('/auth/change-password', {
        currentPassword,
        newPassword
      });

      setPwdSuccess(res.message || 'Password changed successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      loadSecurityLogs();
    } catch (err) {
      setPwdError(err.message || 'Failed to change password. Please verify current password.');
    } finally {
      setPwdLoading(false);
    }
  }

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>Loading profile...</div>;
  }

  if (!profile) return null;

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>
      {/* Profile Header Card */}
      <div className="card" style={{ padding: '28px', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <img
              src={profile.avatar_url || 'https://api.dicebear.com/7.x/bottts/svg?seed=user'}
              alt={profile.name}
              style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--border-color)' }}
            />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>{profile.name}</h1>
                <Badge variant={profile.is_public ? 'green' : 'amber'}>
                  {profile.is_public ? 'Public Profile' : 'Private Profile'}
                </Badge>
                <Badge variant="blue">
                  {currentUser.role?.toUpperCase() || 'DEVELOPER'}
                </Badge>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: '0.85rem', color: 'var(--text-dim)', flexWrap: 'wrap' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Mail size={14} /> {profile.email}
                </span>

                {profile.github_username && (
                  <a
                    href={`https://github.com/${profile.github_username}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: 'var(--accent-blue)', display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none' }}
                  >
                    <GithubIcon size={14} /> @{profile.github_username}
                  </a>
                )}

                {profile.portfolio_url && (
                  <a
                    href={profile.portfolio_url}
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: 'var(--accent-blue)', display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none' }}
                  >
                    <Globe size={14} /> Portfolio
                  </a>
                )}
              </div>
            </div>
          </div>

          <button className="btn btn-secondary btn-sm" onClick={() => setIsEditModalOpen(true)}>
            <Edit3 size={14} /> Edit Profile
          </button>
        </div>
      </div>

      {/* Sub Tabs: Overview vs Account & Security */}
      <div className="tabs" style={{ marginBottom: 20 }}>
        <button
          className={`tab-btn ${activeProfileTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveProfileTab('overview')}
        >
          <User size={16} />
          <span>Profile & Projects</span>
        </button>

        <button
          className={`tab-btn ${activeProfileTab === 'security' ? 'active' : ''}`}
          onClick={() => setActiveProfileTab('security')}
        >
          <Lock size={16} />
          <span>Account Security & Credentials</span>
        </button>
      </div>

      {/* ===================== OVERVIEW TAB ===================== */}
      {activeProfileTab === 'overview' && (
        <>
          {/* Bio & Skills */}
          <div className="card" style={{ padding: '24px', marginBottom: 20 }}>
            <h3 style={{ fontSize: '0.92rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8 }}>About</h3>
            <p style={{ fontSize: '0.92rem', color: 'var(--text-main)', lineHeight: 1.6, marginBottom: 20 }}>
              {profile.bio || 'No biography written yet.'}
            </p>

            <h3 style={{ fontSize: '0.92rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 10 }}>Skills & Tech Stack</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {(!profile.skills || profile.skills.length === 0) ? (
                <span style={{ fontSize: '0.85rem', color: 'var(--text-dim)' }}>No skills listed</span>
              ) : (
                profile.skills.map((s) => (
                  <span
                    key={s.id}
                    style={{
                      background: '#21262d',
                      border: '1px solid var(--border-color)',
                      color: 'var(--text-main)',
                      fontSize: '0.8rem',
                      padding: '4px 10px',
                      borderRadius: '6px'
                    }}
                  >
                    {s.name}
                  </span>
                ))
              )}
            </div>
          </div>

          {/* Projects Showcase */}
          <div className="card" style={{ padding: '24px' }}>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 600, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <FolderGit2 size={18} style={{ color: 'var(--accent-blue)' }} />
              <span>Projects Showcase ({profile.projects?.length || 0})</span>
            </h2>

            {(!profile.projects || profile.projects.length === 0) ? (
              <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-dim)', fontSize: '0.85rem' }}>
                No projects created by this user yet.
              </div>
            ) : (
              <div className="grid-2">
                {profile.projects.map((p) => (
                  <div
                    key={p.id}
                    style={{
                      background: '#161b22',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '14px',
                      cursor: 'pointer'
                    }}
                    onClick={() => onSelectProject(p.id)}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <Badge variant={p.collaboration_type === 'paid' ? 'purple' : 'blue'}>
                        {p.collaboration_type === 'paid' ? 'Paid' : 'Free'}
                      </Badge>
                      <span style={{ fontSize: '0.74rem', color: 'var(--text-dim)' }}>
                        {new Date(p.created_at).toLocaleDateString()}
                      </span>
                    </div>

                    <h4 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--accent-blue)', marginBottom: 4 }}>
                      {p.title}
                    </h4>

                    <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {p.description || 'No description.'}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* ===================== ACCOUNT SECURITY TAB ===================== */}
      {activeProfileTab === 'security' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Change Password Card */}
          <div className="card" style={{ padding: '24px' }}>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 600, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Key size={18} style={{ color: 'var(--accent-blue)' }} />
              <span>Change Account Password</span>
            </h2>
            <p style={{ fontSize: '0.86rem', color: 'var(--text-muted)', marginBottom: 20 }}>
              Ensure your account is protected with a strong, salted password (minimum 8 characters, combining letters and numbers).
            </p>

            {pwdError && (
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
                <span>{pwdError}</span>
              </div>
            )}

            {pwdSuccess && (
              <div style={{
                background: 'var(--accent-green-bg)',
                color: 'var(--accent-green)',
                border: '1px solid rgba(63, 185, 80, 0.4)',
                padding: '10px 14px',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.85rem',
                marginBottom: 16,
                display: 'flex',
                alignItems: 'center',
                gap: 8
              }}>
                <CheckCircle2 size={16} />
                <span>{pwdSuccess}</span>
              </div>
            )}

            <form onSubmit={handleChangePassword}>
              <div className="form-group">
                <label className="form-label">Current Password</label>
                <div className="password-input-wrap">
                  <input
                    type={showCurrentPassword ? 'text' : 'password'}
                    className="input-text"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="password-toggle-btn"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  >
                    {showCurrentPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div className="form-group">
                  <label className="form-label">New Password</label>
                  <div className="password-input-wrap">
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      className="input-text"
                      placeholder="Min 8 chars, letter + number"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                    />
                    <button
                      type="button"
                      className="password-toggle-btn"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                    >
                      {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Confirm New Password</label>
                  <input
                    type="password"
                    className="input-text"
                    placeholder="Re-enter new password"
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
                <button type="submit" className="btn btn-primary btn-sm" disabled={pwdLoading}>
                  <Lock size={14} />
                  <span>{pwdLoading ? 'Updating Password...' : 'Update Password'}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Connected Accounts Card */}
          <div className="card" style={{ padding: '24px' }}>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 600, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Link2 size={18} style={{ color: 'var(--accent-purple)' }} />
              <span>Connected Social & Developer Accounts</span>
            </h2>
            <p style={{ fontSize: '0.86rem', color: 'var(--text-muted)', marginBottom: 16 }}>
              Connect external services to synchronize commit activity and authenticate seamlessly.
            </p>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '14px 18px',
              background: '#111419',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-sm)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  background: '#24292f',
                  color: '#fff',
                  padding: '8px',
                  borderRadius: '6px',
                  display: 'flex'
                }}>
                  <GithubIcon size={20} />
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.92rem' }}>GitHub</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>
                    {profile.github_username
                      ? `Connected as @${profile.github_username}`
                      : 'Not connected to a GitHub profile'}
                  </div>
                </div>
              </div>

              {profile.github_username ? (
                <span style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  color: 'var(--accent-green)',
                  fontSize: '0.82rem',
                  fontWeight: 600
                }}>
                  <CheckCircle2 size={15} /> Linked
                </span>
              ) : (
                <a
                  href="http://localhost:5000/api/auth/github"
                  className="btn btn-secondary btn-sm"
                >
                  Connect GitHub
                </a>
              )}
            </div>
          </div>

          {/* Recent Security Logs Card */}
          <div className="card" style={{ padding: '24px' }}>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 600, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
              <History size={18} style={{ color: 'var(--accent-amber)' }} />
              <span>Security & Audit Activity</span>
            </h2>
            <p style={{ fontSize: '0.86rem', color: 'var(--text-muted)', marginBottom: 16 }}>
              Traceable security audit records for logins, password changes, and account actions.
            </p>

            {logsLoading ? (
              <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>Loading security logs...</div>
            ) : securityLogs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-dim)', fontSize: '0.85rem' }}>
                No recent security events logged for this account.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {securityLogs.map((log) => (
                  <div
                    key={log.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      background: '#111419',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.82rem'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Shield size={14} style={{ color: 'var(--accent-blue)' }} />
                      <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                        {log.action.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <span style={{ color: 'var(--text-dim)', fontSize: '0.78rem' }}>
                      {new Date(log.created_at).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Edit Profile Modal */}
      <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title="Update Profile">
        <form onSubmit={handleUpdateProfile}>
          <div className="form-group">
            <label className="form-label">Bio</label>
            <textarea
              className="input-textarea"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={3}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Avatar Image URL</label>
            <input
              type="url"
              className="input-text"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label className="form-label">GitHub Username</label>
              <input
                type="text"
                className="input-text"
                value={githubUsername}
                onChange={(e) => setGithubUsername(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Portfolio URL</label>
              <input
                type="url"
                className="input-text"
                value={portfolioUrl}
                onChange={(e) => setPortfolioUrl(e.target.value)}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Skills (comma separated)</label>
            <input
              type="text"
              className="input-text"
              value={skillsStr}
              onChange={(e) => setSkillsStr(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.88rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
              />
              <span>Public Profile (allow other developers to discover you)</span>
            </label>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
            <button type="button" className="btn btn-secondary" onClick={() => setIsEditModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Save Changes
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
