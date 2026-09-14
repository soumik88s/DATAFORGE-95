import React, { useEffect, useState, useCallback } from 'react';
import { Navbar, NavView } from './components/layout/Navbar.js';
import { Taskbar } from './components/layout/Taskbar.js';
import { LandingView } from './components/views/LandingView.js';
import { LoginView } from './components/views/LoginView.js';
import { DashboardView } from './components/views/DashboardView.js';
import { DatasetExplorerView } from './components/views/DatasetExplorerView.js';
import { DatasetAnalysisView } from './components/views/DatasetAnalysisView.js';
import { ReportsView } from './components/views/ReportsView.js';
import { AuditLogView } from './components/views/AuditLogView.js';
import { UserManagementView } from './components/views/UserManagementView.js';
import { AuthModal } from './components/views/AuthModal.js';
import { SystemSettingsModal } from './components/views/SystemSettingsModal.js';
import { api, getStoredToken, setStoredToken } from './utils/api.js';
import { User } from './types.js';

const PROTECTED_VIEWS: NavView[] = ['dashboard', 'datasets', 'analysis', 'reports', 'audit', 'users'];

function parsePath(path: string): { view: NavView; mode?: 'login' | 'register' } {
  const clean = path.toLowerCase().replace(/\/$/, '') || '/';
  if (clean === '/login') return { view: 'login', mode: 'login' };
  if (clean === '/register') return { view: 'login', mode: 'register' };
  if (clean === '/dashboard') return { view: 'dashboard' };
  if (clean === '/datasets') return { view: 'datasets' };
  if (clean === '/analysis') return { view: 'analysis' };
  if (clean === '/reports') return { view: 'reports' };
  if (clean === '/audit') return { view: 'audit' };
  if (clean === '/users') return { view: 'users' };
  return { view: 'landing' };
}

function viewToPath(view: NavView, mode: 'login' | 'register' = 'login'): string {
  switch (view) {
    case 'login':
      return mode === 'register' ? '/register' : '/login';
    case 'landing':
      return '/';
    case 'dashboard':
      return '/dashboard';
    case 'datasets':
      return '/datasets';
    case 'analysis':
      return '/analysis';
    case 'reports':
      return '/reports';
    case 'audit':
      return '/audit';
    case 'users':
      return '/users';
    default:
      return '/';
  }
}

export default function App() {
  const [currentView, setCurrentView] = useState<NavView>('landing');
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [selectedDatasetId, setSelectedDatasetId] = useState<string>('ds-1');
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [authInitialized, setAuthInitialized] = useState(false);

  const navigateTo = useCallback(
    (view: NavView, mode: 'login' | 'register' = 'login') => {
      if (view === 'settings') {
        setSettingsModalOpen(true);
        return;
      }

      // Route protection
      let targetView = view;
      let targetMode = mode;

      if (PROTECTED_VIEWS.includes(targetView) && !currentUser) {
        targetView = 'login';
        targetMode = 'login';
      }

      if (targetView === 'login' && currentUser) {
        targetView = 'dashboard';
      }

      const targetPath = viewToPath(targetView, targetMode);
      if (window.location.pathname !== targetPath) {
        window.history.pushState(null, '', targetPath);
      }
      setCurrentView(targetView);
      setAuthMode(targetMode);
    },
    [currentUser]
  );

  // Check auth session on startup with real database verification
  useEffect(() => {
    async function initAuth() {
      const initialInfo = parsePath(window.location.pathname);
      const token = getStoredToken();
      let authenticatedUser: User | null = null;

      if (token) {
        try {
          const res = await api.getMe();
          authenticatedUser = res.user;
          setCurrentUser(authenticatedUser);
        } catch {
          // Token invalid or expired - strictly clear
          setStoredToken(null);
          authenticatedUser = null;
          setCurrentUser(null);
        }
      }

      const isProtected = PROTECTED_VIEWS.includes(initialInfo.view);
      if (isProtected && !authenticatedUser) {
        setCurrentView('login');
        setAuthMode('login');
        window.history.replaceState(null, '', '/login');
      } else if (initialInfo.view === 'login') {
        if (authenticatedUser) {
          setCurrentView('dashboard');
          window.history.replaceState(null, '', '/dashboard');
        } else {
          setCurrentView('login');
          setAuthMode(initialInfo.mode || 'login');
        }
      } else {
        setCurrentView(initialInfo.view);
      }
      setAuthInitialized(true);
    }

    initAuth();

    const handlePopState = () => {
      const info = parsePath(window.location.pathname);
      const token = getStoredToken();
      const isProtected = PROTECTED_VIEWS.includes(info.view);
      if (isProtected && !token) {
        setCurrentView('login');
        setAuthMode('login');
        window.history.replaceState(null, '', '/login');
      } else {
        setCurrentView(info.view);
        if (info.mode) setAuthMode(info.mode);
      }
    };

    const handleUnauthorized = () => {
      setStoredToken(null);
      setCurrentUser(null);
      setCurrentView('login');
      setAuthMode('login');
      window.history.replaceState(null, '', '/login');
    };

    window.addEventListener('popstate', handlePopState);
    window.addEventListener('df95:unauthorized', handleUnauthorized);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('df95:unauthorized', handleUnauthorized);
    };
  }, []);

  const handleLogout = async () => {
    try {
      await api.logout();
    } catch {
      // Ignore network errors on logout
    }
    setStoredToken(null);
    setCurrentUser(null);
    setCurrentView('login');
    setAuthMode('login');
    window.history.replaceState(null, '', '/login');
  };

  const handleLoginSuccess = (user: User) => {
    setCurrentUser(user);
    setAuthModalOpen(false);
    setCurrentView('dashboard');
    window.history.pushState(null, '', '/dashboard');
  };

  const handleOpenDatasetAnalysis = (datasetId: string) => {
    setSelectedDatasetId(datasetId);
    navigateTo('analysis');
  };

  const getViewTitle = () => {
    switch (currentView) {
      case 'landing':
        return 'DATAFORGE 95 - WELCOME';
      case 'login':
        return 'DATAFORGE 95 - LOGON';
      case 'dashboard':
        return 'DATAFORGE 95 - ANALYTICS DASHBOARD';
      case 'datasets':
        return 'DATAFORGE 95 - DATASET REPOSITORY';
      case 'analysis':
        return 'DATAFORGE 95 - DEEP ANALYSIS STUDIO';
      case 'reports':
        return 'DATAFORGE 95 - EXECUTIVE REPORTS';
      case 'audit':
        return 'DATAFORGE 95 - SECURITY AUDIT LOGS';
      case 'users':
        return 'DATAFORGE 95 - USER MANAGEMENT';
      default:
        return 'DATAFORGE 95';
    }
  };

  if (!authInitialized) {
    return (
      <div className="min-h-screen bg-[#008080] flex items-center justify-center font-mono text-white text-sm">
        <div className="bevel-outset p-4 bg-[#c0c0c0] text-black">
          <div className="flex items-center gap-2">
            <span className="animate-spin">⏳</span>
            <span>Initializing DATAFORGE 95 Security Subsystem...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#008080] text-black font-sans flex flex-col selection:bg-[#000080] selection:text-white">
      {/* Authentic Windows 95 Top Menu Bar */}
      <Navbar
        currentView={currentView}
        onSelectView={view => navigateTo(view)}
        currentUser={currentUser}
        onOpenLogin={() => navigateTo('login')}
        onLogout={handleLogout}
      />

      {/* Main Canvas Area */}
      <main className="flex-1 p-2 sm:p-4 max-w-7xl mx-auto w-full pb-14">
        {currentView === 'landing' && (
          <LandingView
            onEnterApp={() => navigateTo(currentUser ? 'dashboard' : 'login')}
            onExploreDatasets={() => navigateTo(currentUser ? 'datasets' : 'login')}
          />
        )}

        {currentView === 'login' && (
          <LoginView
            onLoginSuccess={handleLoginSuccess}
            onNavigateHome={() => navigateTo('landing')}
            initialMode={authMode}
          />
        )}

        {currentView === 'dashboard' && (
          <DashboardView
            onSelectDataset={handleOpenDatasetAnalysis}
            onNavigate={view => navigateTo(view)}
          />
        )}

        {currentView === 'datasets' && (
          <DatasetExplorerView
            currentUser={currentUser}
            onSelectDatasetForAnalysis={handleOpenDatasetAnalysis}
          />
        )}

        {currentView === 'analysis' && (
          <DatasetAnalysisView
            datasetId={selectedDatasetId}
            onBackToDatasets={() => navigateTo('datasets')}
          />
        )}

        {currentView === 'reports' && (
          <ReportsView onSelectDatasetForAnalysis={handleOpenDatasetAnalysis} />
        )}

        {currentView === 'audit' && <AuditLogView />}

        {currentView === 'users' && <UserManagementView />}
      </main>

      {/* Windows 95 System Taskbar at Screen Bottom */}
      <Taskbar
        activeWindowName={getViewTitle()}
        onStartClick={() => {}}
        onOpenSettings={() => setSettingsModalOpen(true)}
      />

      {/* Authentication Dialog Modal */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onLoginSuccess={handleLoginSuccess}
      />

      {/* System Settings & Hardware Diagnostics Dialog */}
      <SystemSettingsModal
        isOpen={settingsModalOpen}
        onClose={() => setSettingsModalOpen(false)}
      />
    </div>
  );
}
