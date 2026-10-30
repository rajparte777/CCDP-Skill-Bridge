import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import AuthModal from './features/auth/AuthModal';
import HomePage from './features/home/HomePage';
import ProjectList from './features/projects/ProjectList';
import ProjectDetail from './features/projects/ProjectDetail';
import DeveloperDirectory from './features/network/DeveloperDirectory';
import ActivityFeed from './features/feed/ActivityFeed';
import CollaborationOffers from './features/collaboration/CollaborationOffers';
import ProfileView from './features/profile/ProfileView';
import { api, getToken, clearToken, setToken } from './services/api';
import { getSocket, resetSocket } from './services/socket';

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [activeTab, setActiveTab] = useState('home'); // 'home', 'projects', 'network', 'feed', 'offers', 'profile'
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authInitialTab, setAuthInitialTab] = useState('login');
  const [notifications, setNotifications] = useState([]);
  const [loadingUser, setLoadingUser] = useState(true);

  // Initialize Auth & Check OAuth / Token callback in URL
  useEffect(() => {
    async function initAuth() {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const tokenFromUrl = urlParams.get('token');
        const authError = urlParams.get('auth_error');
        const resetToken = urlParams.get('reset_token');

        if (authError) {
          alert(`Authentication Notice: ${decodeURIComponent(authError)}`);
          window.history.replaceState({}, document.title, window.location.pathname);
        } else if (resetToken) {
          setAuthInitialTab('forgot');
          setIsAuthModalOpen(true);
        }

        let token = tokenFromUrl;
        if (token) {
          setToken(token);
          // Clean URL without reload
          window.history.replaceState({}, document.title, window.location.pathname);
        } else {
          token = getToken();
        }

        if (!token) {
          setLoadingUser(false);
          return;
        }

        // Validate session with backend
        try {
          const res = await api.get('/auth/me');
          setCurrentUser(res.user);
          loadNotifications();
          setActiveTab('projects');
        } catch (authErr) {
          console.warn('Session verification notice:', authErr.message);
          if (authErr.status === 401) {
            clearToken();
            setCurrentUser(null);
          }
        }
      } catch (err) {
        console.warn('Auth initialization error:', err);
      } finally {
        setLoadingUser(false);
      }
    }

    initAuth();
  }, []);

  async function loadNotifications() {
    try {
      const res = await api.get('/notifications');
      setNotifications(res.notifications || []);
    } catch (err) {
      console.error('Failed to load notifications:', err);
    }
  }

  // Socket.IO real-time notification listener
  useEffect(() => {
    if (!currentUser) return;

    const socket = resetSocket();
    if (!socket) return;

    function handleNewNotification(newNotif) {
      setNotifications(prev => [newNotif, ...prev]);
    }

    socket.on('notification', handleNewNotification);

    return () => {
      socket.off('notification', handleNewNotification);
    };
  }, [currentUser]);

  function handleLogout() {
    clearToken();
    resetSocket();
    setCurrentUser(null);
    setNotifications([]);
    setActiveTab('home');
  }

  async function handleQuickSwitchUser(email) {
    try {
      const res = await api.post('/auth/login', { email, password: 'password123' });
      setToken(res.token);
      setCurrentUser(res.user);
      loadNotifications();
      resetSocket();
      setActiveTab('projects');
    } catch (err) {
      alert(`Could not login to account ${email}: ` + err.message);
    }
  }

  function handleSelectEntity(type, id) {
    if (type === 'PROJECT') {
      setSelectedProjectId(id);
      setActiveTab('projects');
    } else if (type === 'OFFER' || type === 'PAYMENT') {
      setActiveTab('offers');
    }
  }

  function openAuth(tab = 'login') {
    setAuthInitialTab(tab);
    setIsAuthModalOpen(true);
  }

  return (
    <div className="app-container">
      {/* Navbar with Account Dropdown & Notifications */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={(tab) => {
          setActiveTab(tab);
          if (tab === 'projects') {
            setSelectedProjectId(null); // Return to list when tab clicked
          }
        }}
        currentUser={currentUser}
        onOpenAuth={openAuth}
        onLogout={handleLogout}
        onQuickSwitchUser={handleQuickSwitchUser}
        notifications={notifications}
        onNotificationUpdated={loadNotifications}
        onSelectEntity={handleSelectEntity}
      />

      {/* Main Content Area */}
      <main className="main-content">
        {activeTab === 'home' && (
          <HomePage
            onOpenAuth={openAuth}
            onExploreProjects={() => {
              setSelectedProjectId(null);
              setActiveTab('projects');
            }}
            onSelectProject={(id) => {
              setSelectedProjectId(id);
              setActiveTab('projects');
            }}
          />
        )}

        {activeTab === 'projects' && (
          selectedProjectId ? (
            <ProjectDetail
              projectId={selectedProjectId}
              onBack={() => setSelectedProjectId(null)}
              currentUser={currentUser}
              onOpenAuth={() => openAuth('login')}
            />
          ) : (
            <ProjectList
              onSelectProject={(id) => setSelectedProjectId(id)}
              currentUser={currentUser}
              onOpenAuth={() => openAuth('register')}
            />
          )
        )}

        {activeTab === 'network' && (
          <DeveloperDirectory
            currentUser={currentUser}
            onOpenAuth={() => openAuth('login')}
          />
        )}

        {activeTab === 'feed' && (
          <ActivityFeed
            onSelectProject={(id) => {
              setSelectedProjectId(id);
              setActiveTab('projects');
            }}
          />
        )}

        {activeTab === 'offers' && (
          <CollaborationOffers
            currentUser={currentUser}
            viewMode="user"
          />
        )}

        {activeTab === 'profile' && (
          <ProfileView
            currentUser={currentUser}
            onUserUpdated={(u) => setCurrentUser(u)}
            onSelectProject={(id) => {
              setSelectedProjectId(id);
              setActiveTab('projects');
            }}
          />
        )}
      </main>

      {/* Enhanced Auth Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        initialTab={authInitialTab}
        onClose={() => setIsAuthModalOpen(false)}
        onAuthSuccess={(user) => {
          setCurrentUser(user);
          loadNotifications();
          resetSocket();
          setActiveTab('projects');
        }}
      />
    </div>
  );
}
