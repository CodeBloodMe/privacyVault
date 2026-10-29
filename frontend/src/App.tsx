import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { AnalystDashboard } from './components/AnalystDashboard';
import { DatasetExplorer } from './components/DatasetExplorer';
import { DataOwnerPortal } from './components/DataOwnerPortal';
import { AuditorConsole } from './components/AuditorConsole';
import { LoginModal } from './components/LoginModal';
import { DemoScenariosModal } from './components/DemoScenariosModal';
import { FacultyVivaSuiteModal } from './components/FacultyVivaSuiteModal';
import { LandingHero } from './components/LandingHero';
import { api } from './services/api';
import { UserProfile, SystemHealth } from './types/api';
import { Shield, Database, Cpu, CheckCircle } from 'lucide-react';

export const App: React.FC = () => {
  const [user, setUser] = useState<UserProfile | null>(() => {
    const token = api.getToken();
    const cached = localStorage.getItem('pv_user');
    if (token && cached) {
      try {
        return JSON.parse(cached);
      } catch {
        return null;
      }
    }
    return null;
  });
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [activeTab, setActiveTab] = useState<string>('analyst');
  const [isLoginOpen, setIsLoginOpen] = useState<boolean>(false);
  const [isDemoOpen, setIsDemoOpen] = useState<boolean>(false);
  const [isFacultySuiteOpen, setIsFacultySuiteOpen] = useState<boolean>(false);
  const [initializing, setInitializing] = useState<boolean>(true);

  // Strictly ensure user state is never desynced from token
  useEffect(() => {
    if (!api.getToken() && user) {
      setUser(null);
    }
  }, [user]);

  useEffect(() => {
    // Check system health
    api.getHealth()
      .then(setHealth)
      .catch((err) => console.error('Health check failed:', err));

    // Check existing authentication token
    if (api.getToken()) {
      api.getCurrentUser()
        .then((u) => {
          setUser(u);
          localStorage.setItem('pv_user', JSON.stringify(u));
          setInitializing(false);
        })
        .catch(() => {
          api.logout();
          setUser(null);
          setInitializing(false);
        });
    } else {
      setUser(null);
      setInitializing(false);
    }

    const unsubscribeAuth = api.onAuthStateChanged((token) => {
      if (!token) {
        setUser(null);
      }
    });

    const handleSessionExpired = () => {
      setUser(null);
      setIsLoginOpen(true);
    };

    window.addEventListener('pv_session_expired', handleSessionExpired);
    return () => {
      unsubscribeAuth();
      window.removeEventListener('pv_session_expired', handleSessionExpired);
    };
  }, []);

  const handleQuickPersonaLogin = async (email: string, pass: string) => {
    try {
      const res = await api.login(email, pass);
      localStorage.setItem('pv_user', JSON.stringify(res.user));
      setUser(res.user);
      if (res.user.roles.includes('ANALYST')) {
        setActiveTab('analyst');
      } else if (res.user.roles.includes('DATA_OWNER')) {
        setActiveTab('owner');
      } else if (res.user.roles.includes('AUDITOR')) {
        setActiveTab('auditor');
      } else {
        setActiveTab('explorer');
      }
    } catch (err: any) {
      console.error('Quick login failed:', err);
      setIsLoginOpen(true);
    }
  };

  const handleLogout = () => {
    api.logout();
    setUser(null);
    setActiveTab('analyst');
  };

  if (initializing) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
        Connecting to PostgreSQL 17 Gateway...
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      
      {/* Navigation Header */}
      <Navbar
        user={user}
        health={health}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenDemo={() => setIsDemoOpen(true)}
        onOpenLogin={() => setIsLoginOpen(true)}
        onSelectPersona={handleQuickPersonaLogin}
        onLogout={handleLogout}
      />

      {/* Main Content Area */}
      <main style={{ flex: 1 }}>
        {!user ? (
          <LandingHero
            onOpenLogin={() => setIsLoginOpen(true)}
            onOpenDemo={() => setIsDemoOpen(true)}
            onExploreCatalog={() => setIsLoginOpen(true)}
            onSelectPersona={handleQuickPersonaLogin}
          />
        ) : (
          <>
            {activeTab === 'analyst' && <AnalystDashboard key={user.id} />}
            {activeTab === 'explorer' && <DatasetExplorer key={user.id} />}
            {activeTab === 'owner' && <DataOwnerPortal key={user.id} />}
            {activeTab === 'auditor' && <AuditorConsole key={user.id} />}
          </>
        )}
      </main>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid var(--border-subtle)', padding: '16px 24px', background: '#ffffff', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
        <div style={{ maxWidth: 1400, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <strong>PrivacyVault</strong> — Differential-Privacy Analytics Gateway & Governance Console
          </div>
          <div style={{ display: 'flex', gap: 16 }}>
            <span>PostgreSQL 17 ACID Engine</span>
            <span>OpenDP 0.16.0 Rust Core</span>
            <span>HIPAA Safe Harbor De-identification</span>
          </div>
        </div>
      </footer>

      {/* Global Modals */}
      <LoginModal
        isOpen={isLoginOpen}
        onClose={() => setIsLoginOpen(false)}
        onLoginSuccess={(loggedUser) => {
          setUser(loggedUser);
          if (loggedUser.roles.includes('ANALYST')) {
            setActiveTab('analyst');
          } else if (loggedUser.roles.includes('DATA_OWNER')) {
            setActiveTab('owner');
          } else if (loggedUser.roles.includes('AUDITOR')) {
            setActiveTab('auditor');
          } else {
            setActiveTab('explorer');
          }
        }}
      />

      <DemoScenariosModal
        isOpen={isDemoOpen}
        onClose={() => setIsDemoOpen(false)}
      />

      <FacultyVivaSuiteModal
        isOpen={isFacultySuiteOpen}
        onClose={() => setIsFacultySuiteOpen(false)}
        onOpenDemoScenarios={() => {
          setIsFacultySuiteOpen(false);
          setIsDemoOpen(true);
        }}
      />

    </div>
  );
};

export default App;
