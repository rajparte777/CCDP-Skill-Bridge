import React, { useState, useRef, useEffect } from 'react';
import {
  Code2, Compass, Users, Activity, CreditCard, Bell, LogIn,
  LogOut, UserCheck, Shield, ChevronDown, User, Settings, Lock,
  Home, Sparkles
} from 'lucide-react';
import NotificationMenu from './NotificationMenu';

export default function Navbar({
  activeTab,
  setActiveTab,
  currentUser,
  onOpenAuth,
  onLogout,
  onQuickSwitchUser,
  notifications,
  onNotificationUpdated,
  onSelectEntity
}) {
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showTestAccounts, setShowTestAccounts] = useState(false);

  const userMenuRef = useRef(null);
  const unreadCount = notifications.filter(n => !n.is_read).length;

  const demoAccounts = [
    { email: 'alex@example.com', label: 'Alex Rivera (Owner)' },
    { email: 'priya@example.com', label: 'Priya Sharma (Contributor)' },
    { email: 'marcus@example.com', label: 'Marcus Vance (Dev)' },
    { email: 'elena@example.com', label: 'Elena Rostova (Reviewer)' }
  ];

  // Close menus on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setShowUserMenu(false);
        setShowTestAccounts(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <nav className="navbar">
      {/* Brand */}
      <div className="nav-brand" onClick={() => setActiveTab(currentUser ? 'projects' : 'home')}>
        <div className="brand-icon">
          <Code2 size={20} />
        </div>
        <span>DevCollab</span>
      </div>

      {/* Navigation tabs */}
      <div className="nav-links">
        {currentUser ? (
          <>
            <button
              className={`nav-btn ${activeTab === 'projects' ? 'active' : ''}`}
              onClick={() => setActiveTab('projects')}
            >
              <Compass size={17} />
              <span>Projects</span>
            </button>

            <button
              className={`nav-btn ${activeTab === 'network' ? 'active' : ''}`}
              onClick={() => setActiveTab('network')}
            >
              <Users size={17} />
              <span>Developers</span>
            </button>

            <button
              className={`nav-btn ${activeTab === 'feed' ? 'active' : ''}`}
              onClick={() => setActiveTab('feed')}
            >
              <Activity size={17} />
              <span>Activity</span>
            </button>

            <button
              className={`nav-btn ${activeTab === 'offers' ? 'active' : ''}`}
              onClick={() => setActiveTab('offers')}
            >
              <CreditCard size={17} />
              <span>Agreements & Ledger</span>
            </button>

            <button
              className={`nav-btn ${activeTab === 'home' ? 'active' : ''}`}
              onClick={() => setActiveTab('home')}
              title="Learn about DevCollab platform features"
            >
              <Sparkles size={16} style={{ color: 'var(--accent-purple)' }} />
              <span>About Platform</span>
            </button>
          </>
        ) : (
          <>
            <button
              className={`nav-btn ${activeTab === 'home' ? 'active' : ''}`}
              onClick={() => setActiveTab('home')}
            >
              <Home size={17} />
              <span>Home</span>
            </button>

            <button
              className={`nav-btn ${activeTab === 'projects' ? 'active' : ''}`}
              onClick={() => setActiveTab('projects')}
            >
              <Compass size={17} />
              <span>Explore Projects</span>
            </button>

            <button
              className={`nav-btn ${activeTab === 'network' ? 'active' : ''}`}
              onClick={() => setActiveTab('network')}
            >
              <Users size={17} />
              <span>Developers</span>
            </button>

            <button
              className={`nav-btn ${activeTab === 'feed' ? 'active' : ''}`}
              onClick={() => setActiveTab('feed')}
            >
              <Activity size={17} />
              <span>Live Activity</span>
            </button>
          </>
        )}
      </div>

      {/* Right controls */}
      <div className="nav-right">
        {currentUser ? (
          <>
            {/* Notification Bell */}
            <div style={{ position: 'relative' }}>
              <button
                className="nav-btn"
                style={{ padding: '8px', position: 'relative' }}
                onClick={() => {
                  setShowNotifications(!showNotifications);
                  setShowUserMenu(false);
                }}
                aria-label="View notifications"
              >
                <Bell size={18} />
                {unreadCount > 0 && (
                  <span style={{
                    position: 'absolute',
                    top: 4,
                    right: 4,
                    background: 'var(--accent-blue)',
                    color: '#fff',
                    borderRadius: '50%',
                    width: 16,
                    height: 16,
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    {unreadCount}
                  </span>
                )}
              </button>

              {showNotifications && (
                <NotificationMenu
                  notifications={notifications}
                  onNotificationUpdated={onNotificationUpdated}
                  onClose={() => setShowNotifications(false)}
                  onSelectEntity={onSelectEntity}
                />
              )}
            </div>

            {/* Profile Avatar & Interactive User Dropdown */}
            <div style={{ position: 'relative' }} ref={userMenuRef}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  cursor: 'pointer',
                  padding: '4px 8px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: showUserMenu ? 'var(--bg-card-hover)' : 'transparent',
                  transition: 'background-color 0.15s ease'
                }}
                onClick={() => {
                  setShowUserMenu(!showUserMenu);
                  setShowNotifications(false);
                }}
              >
                <img
                  src={currentUser.avatar_url || 'https://api.dicebear.com/7.x/bottts/svg?seed=dev'}
                  alt={currentUser.name}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    objectFit: 'cover',
                    border: '1.5px solid var(--border-color)'
                  }}
                />
                <span style={{ fontSize: '0.88rem', fontWeight: 600 }}>{currentUser.name.split(' ')[0]}</span>
                <ChevronDown size={14} style={{ color: 'var(--text-dim)' }} />
              </div>

              {/* User Dropdown Menu */}
              {showUserMenu && (
                <div className="user-menu-dropdown">
                  <div className="user-menu-header">
                    <div style={{ fontWeight: 600, fontSize: '0.92rem', color: 'var(--text-main)' }}>
                      {currentUser.name}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginBottom: 6 }}>
                      {currentUser.email}
                    </div>
                    <span style={{
                      display: 'inline-block',
                      background: 'var(--accent-blue-bg)',
                      color: 'var(--accent-blue)',
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      padding: '2px 8px',
                      borderRadius: '10px'
                    }}>
                      Role: {currentUser.role?.toUpperCase() || 'USER'}
                    </span>
                  </div>

                  <div style={{ padding: '6px 0' }}>
                    <button
                      className="user-menu-item"
                      onClick={() => {
                        setActiveTab('profile');
                        setShowUserMenu(false);
                      }}
                    >
                      <User size={15} style={{ color: 'var(--accent-blue)' }} />
                      <span>Your Profile</span>
                    </button>

                    <button
                      className="user-menu-item"
                      onClick={() => {
                        setActiveTab('profile');
                        setShowUserMenu(false);
                      }}
                    >
                      <Lock size={15} style={{ color: 'var(--accent-purple)' }} />
                      <span>Account Security</span>
                    </button>

                    <button
                      className="user-menu-item"
                      onClick={() => {
                        setActiveTab('offers');
                        setShowUserMenu(false);
                      }}
                    >
                      <CreditCard size={15} style={{ color: 'var(--accent-green)' }} />
                      <span>Agreements & Ledger</span>
                    </button>

                    {/* Test Personas Submenu for Academic Evaluators */}
                    <div style={{ borderTop: '1px solid var(--border-color)', margin: '4px 0', padding: '4px 0' }}>
                      <button
                        className="user-menu-item"
                        onClick={() => setShowTestAccounts(!showTestAccounts)}
                        style={{ justifyContent: 'space-between' }}
                      >
                        <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <UserCheck size={15} style={{ color: 'var(--accent-amber)' }} />
                          <span>Switch Test Persona</span>
                        </span>
                        <ChevronDown size={12} style={{ transform: showTestAccounts ? 'rotate(180deg)' : 'none' }} />
                      </button>

                      {showTestAccounts && (
                        <div style={{ background: '#0d1117', padding: '4px 8px', borderRadius: '4px', margin: '4px 8px' }}>
                          {demoAccounts.map(acc => (
                            <button
                              key={acc.email}
                              className={`user-menu-item ${currentUser?.email === acc.email ? 'active' : ''}`}
                              style={{
                                fontSize: '0.78rem',
                                padding: '6px 8px',
                                color: currentUser?.email === acc.email ? 'var(--accent-blue)' : 'var(--text-muted)'
                              }}
                              onClick={() => {
                                onQuickSwitchUser(acc.email);
                                setShowUserMenu(false);
                              }}
                            >
                              <span>{acc.label}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <div style={{ borderTop: '1px solid var(--border-color)', marginTop: 4, paddingTop: 4 }}>
                      <button
                        className="user-menu-item danger"
                        onClick={() => {
                          setShowUserMenu(false);
                          onLogout();
                        }}
                      >
                        <LogOut size={15} />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => onOpenAuth('login')}
            >
              <LogIn size={14} />
              <span>Sign In</span>
            </button>

            <button
              className="btn btn-primary btn-sm"
              onClick={() => onOpenAuth('register')}
            >
              <span>Get Started</span>
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}
