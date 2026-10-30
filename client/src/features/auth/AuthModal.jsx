import React, { useState, useEffect } from 'react';
import Modal from '../../components/Modal';
import { api, setToken } from '../../services/api';
import {
  LogIn, UserPlus, KeyRound, Eye, EyeOff, AlertCircle, CheckCircle2,
  Lock, Mail, User, ShieldCheck, ArrowLeft, RefreshCw
} from 'lucide-react';

function GithubIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
    </svg>
  );
}

export default function AuthModal({ isOpen, onClose, onAuthSuccess, initialTab = 'login' }) {
  const [activeTab, setActiveTab] = useState(initialTab); // 'login', 'register', 'forgot', 'demo'
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [skillsStr, setSkillsStr] = useState('React.js, Node.js');
  const [bio, setBio] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(true);

  // Forgot / Reset password state
  const [resetEmail, setResetEmail] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [resetSuccessMessage, setResetSuccessMessage] = useState(null);

  // GitHub status
  const [githubStatus, setGithubStatus] = useState(null);

  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      setError(null);
      setSuccess(null);
      checkGitHubStatus();
    }
  }, [isOpen, initialTab]);

  async function checkGitHubStatus() {
    try {
      const res = await api.get('/auth/github/status');
      setGithubStatus(res);
    } catch (e) {
      setGithubStatus({ configured: false });
    }
  }

  // Password strength calculation
  function calculateStrength(pwd) {
    if (!pwd) return { score: 0, text: 'None', color: 'gray' };
    let score = 0;
    if (pwd.length >= 8) score++;
    if (/[a-zA-Z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^a-zA-Z0-9]/.test(pwd) || pwd.length >= 12) score++;

    if (score <= 1) return { score: 1, text: 'Weak (needs 8+ chars & letters/numbers)', color: 'var(--accent-red)' };
    if (score === 2) return { score: 2, text: 'Fair (add numbers or special characters)', color: 'var(--accent-amber)' };
    if (score === 3) return { score: 3, text: 'Good (secure password)', color: 'var(--accent-blue)' };
    return { score: 4, text: 'Strong (high security)', color: 'var(--accent-green)' };
  }

  const strength = calculateStrength(password);
  const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword;

  async function handleLogin(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await api.post('/auth/login', { email, password });
      setToken(res.token);
      onAuthSuccess(res.user);
      onClose();
    } catch (err) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(e) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError('Passwords do not match. Please re-enter.');
      return;
    }

    if (strength.score < 2) {
      setError('Please choose a stronger password (at least 8 characters with letters and numbers).');
      return;
    }

    if (!termsAccepted) {
      setError('Please accept the Terms of Service to continue.');
      return;
    }

    setLoading(true);
    try {
      const skills = skillsStr.split(',').map(s => s.trim()).filter(Boolean);
      const res = await api.post('/auth/register', {
        name,
        email,
        password,
        bio,
        skills
      });

      setToken(res.token);
      onAuthSuccess(res.user);
      onClose();
    } catch (err) {
      setError(err.message || 'Registration failed. Email may already be taken.');
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotPassword(e) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const res = await api.post('/auth/forgot-password', { email: resetEmail });
      setSuccess(res.message);
      if (res.resetToken) {
        setResetToken(res.resetToken);
      }
    } catch (err) {
      setError(err.message || 'Failed to generate reset link.');
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPassword(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await api.post('/auth/reset-password', {
        resetToken,
        newPassword
      });
      setResetSuccessMessage(res.message);
      setSuccess('Password updated! You can now sign in with your new password.');
      setActiveTab('login');
      setPassword(newPassword);
      setEmail(resetEmail);
    } catch (err) {
      setError(err.message || 'Failed to reset password.');
    } finally {
      setLoading(false);
    }
  }

  function handleGitHubClick() {
    const origin = encodeURIComponent(window.location.origin);
    // If client credentials are configured, launch real GitHub OAuth
    if (githubStatus?.configured) {
      window.location.href = `http://localhost:5000/api/auth/github?origin=${origin}`;
    } else {
      // Connect using GitHub Sandbox mode
      window.location.href = `http://localhost:5000/api/auth/github/sandbox?origin=${origin}`;
    }
  }

  function fillDemoAccount(demoEmail) {
    setEmail(demoEmail);
    setPassword('password123');
    setActiveTab('login');
  }

  const demoAccounts = [
    { email: 'alex@example.com', label: 'Alex Rivera', role: 'Project Owner', stack: 'Full-stack Architect' },
    { email: 'priya@example.com', label: 'Priya Sharma', role: 'Contributor', stack: 'Frontend & UI Specialist' },
    { email: 'marcus@example.com', label: 'Marcus Vance', role: 'Backend Engineer', stack: 'Cloud & Database Dev' },
    { email: 'elena@example.com', label: 'Elena Rostova', role: 'Code Reviewer', stack: 'Security & QA Auditor' }
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        activeTab === 'forgot'
          ? 'Password Recovery'
          : activeTab === 'demo'
          ? 'Test Personas & Presets'
          : activeTab === 'register'
          ? 'Join DevCollab'
          : 'Sign In to DevCollab'
      }
    >
      {/* Alert Notices */}
      {error && (
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
          <span>{error}</span>
        </div>
      )}

      {success && (
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
          <span>{success}</span>
        </div>
      )}

      {/* Segmented Control Tabs */}
      {activeTab !== 'forgot' && (
        <div className="auth-segmented-tabs">
          <button
            type="button"
            className={`auth-segment-btn ${activeTab === 'login' ? 'active' : ''}`}
            onClick={() => { setActiveTab('login'); setError(null); }}
          >
            Sign In
          </button>
          <button
            type="button"
            className={`auth-segment-btn ${activeTab === 'register' ? 'active' : ''}`}
            onClick={() => { setActiveTab('register'); setError(null); }}
          >
            Create Account
          </button>
          <button
            type="button"
            className={`auth-segment-btn ${activeTab === 'demo' ? 'active' : ''}`}
            onClick={() => { setActiveTab('demo'); setError(null); }}
          >
            Demo Presets
          </button>
        </div>
      )}

      {/* GitHub OAuth Button (Available on Sign In and Register) */}
      {(activeTab === 'login' || activeTab === 'register') && (
        <>
          <button
            type="button"
            className="auth-github-btn"
            onClick={handleGitHubClick}
            title={githubStatus?.configured ? 'Authenticate with your official GitHub account' : 'Sign in via GitHub Sandbox Authorization'}
          >
            <GithubIcon size={19} />
            <span>Continue with GitHub</span>
            {!githubStatus?.configured && (
              <span style={{
                background: 'var(--accent-blue-bg)',
                color: 'var(--accent-blue)',
                padding: '2px 6px',
                borderRadius: '8px',
                fontSize: '0.7rem',
                marginLeft: 4
              }}>
                Sandbox Ready
              </span>
            )}
          </button>

          <div className="auth-divider">
            <span>or continue with email</span>
          </div>
        </>
      )}

      {/* ===================== SIGN IN VIEW ===================== */}
      {activeTab === 'login' && (
        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label className="form-label">Email Address</label>
            <div className="password-input-wrap">
              <input
                type="email"
                className="input-text"
                placeholder="developer@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
          </div>

          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <label className="form-label" style={{ margin: 0 }}>Password</label>
              <button
                type="button"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--accent-blue)',
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  padding: 0
                }}
                onClick={() => {
                  setResetEmail(email);
                  setActiveTab('forgot');
                  setError(null);
                }}
              >
                Forgot password?
              </button>
            </div>

            <div className="password-input-wrap">
              <input
                type={showPassword ? 'text' : 'password'}
                className="input-text"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
              <button
                type="button"
                className="password-toggle-btn"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', color: 'var(--text-muted)', cursor: 'pointer' }}>
              <input type="checkbox" defaultChecked />
              <span>Keep me signed in</span>
            </label>
          </div>

          <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: '100%' }}>
            <LogIn size={16} />
            <span>{loading ? 'Authenticating...' : 'Sign In'}</span>
          </button>
        </form>
      )}

      {/* ===================== CREATE ACCOUNT VIEW ===================== */}
      {activeTab === 'register' && (
        <form onSubmit={handleRegister}>
          <div className="form-group">
            <label className="form-label">Full Name *</label>
            <input
              type="text"
              className="input-text"
              placeholder="e.g. Maya Lin"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Email Address *</label>
            <input
              type="email"
              className="input-text"
              placeholder="maya.lin@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Password *</label>
            <div className="password-input-wrap">
              <input
                type={showPassword ? 'text' : 'password'}
                className="input-text"
                placeholder="At least 8 characters with letters & numbers"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="new-password"
              />
              <button
                type="button"
                className="password-toggle-btn"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            {/* Strength Meter */}
            {password.length > 0 && (
              <div className="strength-meter-container">
                <div className="strength-bars">
                  <div className="strength-bar" style={{ backgroundColor: strength.score >= 1 ? strength.color : '#21262d' }} />
                  <div className="strength-bar" style={{ backgroundColor: strength.score >= 2 ? strength.color : '#21262d' }} />
                  <div className="strength-bar" style={{ backgroundColor: strength.score >= 3 ? strength.color : '#21262d' }} />
                  <div className="strength-bar" style={{ backgroundColor: strength.score >= 4 ? strength.color : '#21262d' }} />
                </div>
                <div className="strength-label">
                  <span style={{ color: strength.color }}>{strength.text}</span>
                </div>
              </div>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">Confirm Password *</label>
            <div className="password-input-wrap">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                className="input-text"
                placeholder="Repeat your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                autoComplete="new-password"
              />
              <button
                type="button"
                className="password-toggle-btn"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            {confirmPassword.length > 0 && (
              <div style={{ marginTop: 4, fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: 4, color: passwordsMatch ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                {passwordsMatch ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}
                <span>{passwordsMatch ? 'Passwords match' : 'Passwords do not match'}</span>
              </div>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">Technical Skills (comma separated)</label>
            <input
              type="text"
              className="input-text"
              placeholder="React.js, Node.js, PostgreSQL, TypeScript"
              value={skillsStr}
              onChange={(e) => setSkillsStr(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Bio (Optional)</label>
            <textarea
              className="input-textarea"
              placeholder="A brief summary of your developer background..."
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={2}
            />
          </div>

          <div className="form-group" style={{ marginBottom: 20 }}>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: '0.8rem', color: 'var(--text-muted)', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
                style={{ marginTop: 2 }}
              />
              <span>I agree to the DevCollab Developer Agreement and Privacy Policy.</span>
            </label>
          </div>

          <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: '100%' }}>
            <UserPlus size={16} />
            <span>{loading ? 'Creating Account...' : 'Create Account'}</span>
          </button>
        </form>
      )}

      {/* ===================== FORGOT PASSWORD VIEW ===================== */}
      {activeTab === 'forgot' && (
        <div>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            style={{ marginBottom: 16 }}
            onClick={() => { setActiveTab('login'); setError(null); }}
          >
            <ArrowLeft size={14} /> Back to Sign In
          </button>

          {!resetToken ? (
            <form onSubmit={handleForgotPassword}>
              <p style={{ fontSize: '0.86rem', color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.5 }}>
                Enter the email address registered with your DevCollab account. We will generate a secure password reset authorization token.
              </p>

              <div className="form-group">
                <label className="form-label">Email Address</label>
                <input
                  type="email"
                  className="input-text"
                  placeholder="developer@example.com"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  required
                />
              </div>

              <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: '100%' }}>
                <span>{loading ? 'Generating...' : 'Send Password Reset Token'}</span>
              </button>
            </form>
          ) : (
            <form onSubmit={handleResetPassword}>
              <div style={{
                background: '#111419',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-sm)',
                padding: '12px',
                marginBottom: 16,
                fontSize: '0.82rem'
              }}>
                <div style={{ color: 'var(--text-muted)', marginBottom: 4 }}>Generated Reset Token:</div>
                <code style={{ color: 'var(--accent-blue)', wordBreak: 'break-all' }}>{resetToken}</code>
              </div>

              <div className="form-group">
                <label className="form-label">New Password</label>
                <input
                  type="password"
                  className="input-text"
                  placeholder="At least 8 characters with letters & numbers"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
              </div>

              <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: '100%' }}>
                <span>{loading ? 'Resetting Password...' : 'Update & Reset Password'}</span>
              </button>
            </form>
          )}
        </div>
      )}

      {/* ===================== TEST PRESETS / DEMO VIEW ===================== */}
      {activeTab === 'demo' && (
        <div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 16 }}>
            Quickly authenticate into pre-configured academic evaluator accounts to test role-based permissions:
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {demoAccounts.map((acc) => (
              <div
                key={acc.email}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 14px',
                  background: '#111419',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-sm)'
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-main)' }}>
                    {acc.label}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>
                    {acc.email} • <span style={{ color: 'var(--accent-blue)' }}>{acc.role}</span>
                  </div>
                </div>

                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => fillDemoAccount(acc.email)}
                >
                  <KeyRound size={13} /> Select
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </Modal>
  );
}
