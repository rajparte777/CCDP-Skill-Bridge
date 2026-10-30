import React, { useState } from 'react';
import {
  Code2, Users, GitBranch, GitPullRequest, DollarSign, CheckCircle2,
  ArrowRight, ShieldCheck, Zap, Lock, Terminal, Sparkles, Check,
  LogIn, UserPlus, Play, HeartHandshake, FileCode, Radio
} from 'lucide-react';
import Badge from '../../components/Badge';

function GithubIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
    </svg>
  );
}

export default function HomePage({ onOpenAuth, onExploreProjects, onSelectProject }) {
  const [activeFeatureIndex, setActiveFeatureIndex] = useState(0);

  function handleGitHubLogin() {
    window.location.href = 'http://localhost:5000/api/auth/github';
  }

  const features = [
    {
      icon: <FileCode size={24} style={{ color: 'var(--accent-blue)' }} />,
      tag: 'Real-Time Sync',
      title: 'Collaborative Monaco Editor',
      desc: 'Simultaneous in-browser code editing powered by Monaco Editor and Socket.IO. Features active peer presence chips, auto-save persistence, and viewer read-only role enforcement.'
    },
    {
      icon: <Users size={24} style={{ color: 'var(--accent-green)' }} />,
      tag: 'Networking & Teams',
      title: 'Developer Identity & Discovery',
      desc: 'Comprehensive developer profiles featuring verified tech skill taxonomies, portfolio showcases, and a connection request system built specifically for software engineers.'
    },
    {
      icon: <GitBranch size={24} style={{ color: 'var(--accent-purple)' }} />,
      tag: 'GitHub Integration',
      title: 'Cryptographic Webhook Engine',
      desc: 'Link external GitHub repositories, verify HMAC-SHA256 signatures, deduplicate delivery IDs to avoid replay issues, and follow repository commit and pull request streams.'
    },
    {
      icon: <GitPullRequest size={24} style={{ color: 'var(--accent-amber)' }} />,
      tag: 'Code Quality',
      title: 'Structured Reviews & Inline Corrections',
      desc: 'Conduct detailed code inspections with line-level commentary, proposed diff replacements with 1-click acceptance, and formal reviewer decision approvals.'
    },
    {
      icon: <CheckCircle2 size={24} style={{ color: 'var(--accent-blue)' }} />,
      tag: 'Sprint Tracking',
      title: 'Interactive Kanban Milestones',
      desc: 'Organize team deliverables across customizable Kanban task boards with real-time assignment alerts, priority levels, and due date scheduling.'
    },
    {
      icon: <DollarSign size={24} style={{ color: 'var(--accent-green)' }} />,
      tag: 'Milestone Compensation',
      title: 'Agreements & Payment Sandbox',
      desc: 'Formalize work scope through unpaid open-source agreements or paid milestone compensation contracts backed by verified provider transaction settlement.'
    }
  ];

  const workflowSteps = [
    {
      step: '01',
      title: 'Connect & Form Teams',
      desc: 'Discover developers matching your required tech stack, send connection requests, and invite collaborators with granular roles (Owner, Contributor, Reviewer, Viewer).'
    },
    {
      step: '02',
      title: 'Code & Review Together',
      desc: 'Open project files in the integrated Monaco editor. Watch collaborator keystrokes live, submit line-by-line review comments, and approve pull requests.'
    },
    {
      step: '03',
      title: 'Track Milestones & Ship',
      desc: 'Synchronize commits via GitHub webhooks, track sprint tasks on the Kanban board, and settle milestone agreements in the verified payment sandbox.'
    }
  ];

  return (
    <div className="home-container">
      {/* ===================== HERO SECTION ===================== */}
      <section className="hero-section">
        <div className="hero-badge">
          <Sparkles size={14} style={{ color: 'var(--accent-blue)' }} />
          <span>DevCollab 1.0 • Collaborative Development & Networking Platform</span>
        </div>

        <h1 className="hero-title">
          Where Developers Connect, <br />
          <span className="hero-gradient-text">Code in Real Time</span> & Ship Together
        </h1>

        <p className="hero-subtitle">
          DevCollab eliminates workflow fragmentation across developer tools. A unified platform combining verified professional networking, shared Monaco code editing, GitHub webhook synchronizations, structured code reviews, and milestone compensation.
        </p>

        {/* Hero CTA Controls */}
        <div className="hero-actions">
          <button className="btn btn-primary hero-btn-lg" onClick={() => onOpenAuth('register')}>
            <UserPlus size={18} />
            <span>Get Started Free</span>
          </button>

          <button className="btn auth-github-btn hero-btn-lg" onClick={handleGitHubLogin} style={{ width: 'auto' }}>
            <GithubIcon size={18} />
            <span>Continue with GitHub</span>
          </button>

          <button className="btn btn-secondary hero-btn-lg" onClick={onExploreProjects}>
            <span>Explore Projects</span>
            <ArrowRight size={16} />
          </button>
        </div>

        {/* Live Editor Preview Mockup */}
        <div className="hero-mockup-wrapper">
          <div className="hero-mockup-card">
            {/* Terminal Window Header */}
            <div className="mockup-header">
              <div className="mockup-dots">
                <span className="dot dot-red" />
                <span className="dot dot-amber" />
                <span className="dot dot-green" />
              </div>
              <div className="mockup-title">
                <FileCode size={14} style={{ color: 'var(--accent-blue)' }} />
                <span>DevCollab Core Suite — src/syncEngine.js</span>
              </div>
              <div className="mockup-presence">
                <div className="presence-chip">
                  <span className="presence-dot" />
                  <span>Alex Rivera (Owner)</span>
                </div>
                <div className="presence-chip">
                  <span className="presence-dot" />
                  <span>Priya Sharma (Contributor)</span>
                </div>
              </div>
            </div>

            {/* Code Content */}
            <div className="mockup-code-body">
              <div className="code-lines">
                <div className="code-line"><span className="line-num">1</span><span className="syntax-comment">// DevCollab Collaborative Synchronizer Engine</span></div>
                <div className="code-line"><span className="line-num">2</span><span className="syntax-keyword">import</span> &#123; <span className="syntax-var">CRDTSynchronizer</span> &#125; <span className="syntax-keyword">from</span> <span className="syntax-string">'@devcollab/core'</span>;</div>
                <div className="code-line"><span className="line-num">3</span></div>
                <div className="code-line"><span className="line-num">4</span><span className="syntax-keyword">export async function</span> <span className="syntax-func">synchronizeDelta</span>(<span className="syntax-var">docId</span>, <span className="syntax-var">peerChanges</span>) &#123;</div>
                <div className="code-line active-line"><span className="line-num">5</span>  <span className="syntax-keyword">const</span> <span className="syntax-var">session</span> = <span className="syntax-keyword">await</span> <span className="syntax-var">CRDTSynchronizer</span>.<span className="syntax-func">applyDelta</span>(<span className="syntax-var">docId</span>, <span className="syntax-var">peerChanges</span>);<span className="typing-cursor" /></div>
                <div className="code-line"><span className="line-num">6</span>  <span className="syntax-keyword">return</span> &#123; <span className="syntax-prop">status</span>: <span className="syntax-string">'synchronized'</span>, <span className="syntax-prop">latency</span>: <span className="syntax-string">'&lt; 50ms'</span> &#125;;</div>
                <div className="code-line"><span className="line-num">7</span>&#125;</div>
              </div>
            </div>

            {/* Mockup Status Footer */}
            <div className="mockup-footer">
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--accent-green)' }}>
                  <CheckCircle2 size={13} /> Auto-Saved
                </span>
                <span style={{ color: 'var(--text-dim)' }}>UTF-8</span>
                <span style={{ color: 'var(--text-dim)' }}>JavaScript (ES Modules)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--accent-blue)' }}>
                <Radio size={12} className="pulse" />
                <span>Socket.IO Active Room: doc_main_suite</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===================== PLATFORM STATS BAR ===================== */}
      <section className="stats-bar">
        <div className="stat-item">
          <div className="stat-number">Dual Engine</div>
          <div className="stat-label">PostgreSQL 17 + SQLite Zero-Friction Fallback</div>
        </div>
        <div className="stat-item">
          <div className="stat-number">&lt; 500 ms</div>
          <div className="stat-label">Real-Time Concurrent Edit Latency Target</div>
        </div>
        <div className="stat-item">
          <div className="stat-number">HMAC-SHA256</div>
          <div className="stat-label">Cryptographically Verified Webhook Ingestion</div>
        </div>
        <div className="stat-item">
          <div className="stat-number">Full RBAC</div>
          <div className="stat-label">Granular Owner, Contributor, Reviewer & Viewer Roles</div>
        </div>
      </section>

      {/* ===================== CORE CAPABILITIES ===================== */}
      <section className="features-section">
        <div className="section-header">
          <Badge variant="blue">Engineered for Builders</Badge>
          <h2 className="section-title">Everything Your Development Team Needs</h2>
          <p className="section-subtitle">
            Say goodbye to juggling four separate browser tabs for repositories, video chats, review tools, and communication channels.
          </p>
        </div>

        <div className="features-grid">
          {features.map((f, i) => (
            <div key={i} className="feature-card">
              <div className="feature-card-header">
                <div className="feature-icon-box">{f.icon}</div>
                <Badge variant="gray">{f.tag}</Badge>
              </div>
              <h3 className="feature-card-title">{f.title}</h3>
              <p className="feature-card-desc">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ===================== 3-STEP WORKFLOW ===================== */}
      <section className="workflow-section">
        <div className="section-header">
          <Badge variant="purple">Unified Architecture</Badge>
          <h2 className="section-title">How DevCollab Works</h2>
          <p className="section-subtitle">
            From team discovery to code reviews and milestone compensation in three seamless phases.
          </p>
        </div>

        <div className="workflow-grid">
          {workflowSteps.map((w, i) => (
            <div key={i} className="workflow-card">
              <div className="workflow-step-num">{w.step}</div>
              <h3 className="workflow-card-title">{w.title}</h3>
              <p className="workflow-card-desc">{w.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ===================== INLINE AUTHENTICATION PROMPT ===================== */}
      <section className="home-auth-banner">
        <div className="card home-auth-card">
          <div style={{ flex: '1 1 340px' }}>
            <Badge variant="green">Instant Onboarding</Badge>
            <h2 style={{ fontSize: '1.6rem', fontWeight: 700, margin: '10px 0 8px' }}>
              Ready to collaborate on your next software project?
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', lineHeight: 1.5, marginBottom: 16 }}>
              Sign up today with your email or connect via GitHub to immediately create workspaces, invite collaborators, and edit code together.
            </p>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button className="btn btn-primary" onClick={() => onOpenAuth('register')}>
                <UserPlus size={16} /> Create Free Account
              </button>
              <button className="btn btn-secondary" onClick={() => onOpenAuth('login')}>
                <LogIn size={16} /> Existing User Sign In
              </button>
            </div>
          </div>

          <div className="auth-sandbox-info-box">
            <h4 style={{ fontSize: '0.92rem', fontWeight: 600, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <ShieldCheck size={16} style={{ color: 'var(--accent-blue)' }} />
              <span>Academic Evaluation Ready</span>
            </h4>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.4, marginBottom: 10 }}>
              Testing the project? DevCollab comes pre-loaded with four evaluative test accounts (Alex Rivera, Priya Sharma, Marcus Vance, Elena Rostova) for testing multi-role workflows.
            </p>
            <button className="btn btn-secondary btn-sm" onClick={() => onOpenAuth('demo')}>
              <span>View Test Personas</span>
            </button>
          </div>
        </div>
      </section>

      {/* ===================== FOOTER ===================== */}
      <footer className="home-footer">
        <div className="footer-top">
          <div className="footer-brand">
            <div className="brand-icon">
              <Code2 size={20} />
            </div>
            <span style={{ fontWeight: 700, fontSize: '1.1rem' }}>DevCollab</span>
          </div>

          <p style={{ color: 'var(--text-dim)', fontSize: '0.82rem', maxWidth: '400px' }}>
            Computer Engineering Major Project — Collaborative Development & Networking Platform. Conforming to IEEE SRS Standards.
          </p>

          <div style={{ display: 'flex', gap: 12 }}>
            <button className="btn btn-secondary btn-sm" onClick={onExploreProjects}>
              Explore Workspaces
            </button>
            <button className="btn btn-primary btn-sm" onClick={() => onOpenAuth('login')}>
              Sign In
            </button>
          </div>
        </div>

        <div className="footer-bottom">
          <span>Version 1.0 • Academic Baseline Release • October 2026</span>
          <span>React.js • Node.js • Express • PostgreSQL • Socket.IO • Monaco Editor</span>
        </div>
      </footer>
    </div>
  );
}
