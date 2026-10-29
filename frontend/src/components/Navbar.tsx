import React, { useState } from 'react';
import { Shield, Database, Lock, Play, LogOut, CheckCircle, Award, Users, ChevronDown } from 'lucide-react';
import { UserProfile, SystemHealth } from '../types/api';

interface NavbarProps {
  user: UserProfile | null;
  health: SystemHealth | null;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onOpenDemo: () => void;
  onOpenLogin: () => void;
  onSelectPersona: (email: string, pass: string) => void;
  onLogout: () => void;
}

const PERSONAS = [
  { role: 'ANALYST 1', name: 'Krish (Lead Epidemiologist)', email: 'krish.24bce0846@vitstudent.ac.in', pass: 'AnalystPass2026!' },
  { role: 'ANALYST 2', name: 'Parv (Biostatistician)', email: 'parv.24bce0870@vitstudent.ac.in', pass: 'AnalystPass2026!' },
  { role: 'DATA CUSTODIAN', name: 'Dr. V. Sivakumar (Chief Data Officer)', email: 'dr.sivakumar@vit.ac.in', pass: 'OwnerPass2026!' },
  { role: 'AUDITOR', name: 'Compliance Auditor', email: 'compliance.auditor@vit.ac.in', pass: 'AuditorPass2026!' }
];

export const Navbar: React.FC<NavbarProps> = ({
  user,
  health,
  activeTab,
  setActiveTab,
  onOpenDemo,
  onOpenLogin,
  onSelectPersona,
  onLogout
}) => {
  const [showPersonaMenu, setShowPersonaMenu] = useState(false);

  return (
    <header style={{ background: '#ffffff', borderBottom: '1px solid var(--border-subtle)', position: 'sticky', top: 0, zIndex: 50, boxShadow: 'var(--shadow-sm)' }}>
      <div style={{ maxWidth: 1440, margin: '0 auto', padding: '10px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
        
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 38, height: 38, borderRadius: 'var(--radius-md)', background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(30, 64, 175, 0.3)' }}>
            <Shield size={20} color="#ffffff" strokeWidth={2.4} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: '1.2rem', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>PrivacyVault</span>
              <span className="badge badge-cyan" style={{ fontSize: '0.62rem', fontWeight: 700 }}>v1.0.0</span>
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              Differential-Privacy Analytics Gateway & Governance Console
            </div>
          </div>
        </div>

        {/* Platform Status & Security Badges */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <div className="badge badge-violet" style={{ fontSize: '0.68rem', padding: '4px 8px' }}>
            <Database size={11} />
            PostgreSQL 17 | OpenDP 0.16
          </div>
          {health?.database.connected && (
            <div className="badge badge-emerald" style={{ fontSize: '0.68rem', padding: '4px 8px' }}>
              <CheckCircle size={11} /> DB Online (Port 5434)
            </div>
          )}
          <div className="badge badge-cyan" style={{ fontSize: '0.68rem', padding: '4px 8px' }}>
            HIPAA De-identified
          </div>
        </div>

        {/* Nav Tabs */}
        {user && (
          <nav style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {(user.roles.includes('ANALYST') || user.roles.includes('ADMIN')) && (
              <button
                onClick={() => setActiveTab('analyst')}
                className={`btn ${activeTab === 'analyst' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '6px 12px', fontSize: '0.78rem' }}
              >
                Analytics Gateway
              </button>
            )}
            <button
              onClick={() => setActiveTab('explorer')}
              className={`btn ${activeTab === 'explorer' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '6px 12px', fontSize: '0.78rem' }}
            >
              Dataset Catalog
            </button>
            {(user.roles.includes('DATA_OWNER') || user.roles.includes('ADMIN')) && (
              <button
                onClick={() => setActiveTab('owner')}
                className={`btn ${activeTab === 'owner' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '6px 12px', fontSize: '0.78rem' }}
              >
                Data Governance
              </button>
            )}
            {(user.roles.includes('AUDITOR') || user.roles.includes('ADMIN') || user.roles.includes('DATA_OWNER')) && (
              <button
                onClick={() => setActiveTab('auditor')}
                className={`btn ${activeTab === 'auditor' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '6px 12px', fontSize: '0.78rem' }}
              >
                Audit & Ledger
              </button>
            )}
          </nav>
        )}

        {/* Actions & Persona Switcher */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>

          <button
            onClick={onOpenDemo}
            className="btn btn-secondary"
            style={{ padding: '6px 10px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}
            title="Demonstration Scenarios A through H"
          >
            <Play size={12} color="var(--accent-primary)" />
            Scenarios (A–H)
          </button>

          {user ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderLeft: '1px solid var(--border-subtle)', paddingLeft: 10, position: 'relative' }}>
              
              {/* Quick Persona Switcher Dropdown */}
              <div style={{ position: 'relative' }}>
                <button
                  type="button"
                  onClick={() => setShowPersonaMenu(!showPersonaMenu)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '5px 8px',
                    background: 'var(--bg-subtle)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                    color: 'var(--text-primary)',
                    fontWeight: 600
                  }}
                  title="Switch between demonstration roles instantly"
                >
                  <Users size={12} color="var(--accent-primary)" />
                  <span>Switch Role</span>
                  <ChevronDown size={11} />
                </button>

                {showPersonaMenu && (
                  <div 
                    style={{
                      position: 'absolute',
                      right: 0,
                      top: '100%',
                      marginTop: 6,
                      background: '#ffffff',
                      border: '1px solid var(--border-strong)',
                      borderRadius: 'var(--radius-md)',
                      boxShadow: 'var(--shadow-dropdown)',
                      zIndex: 60,
                      width: 240,
                      overflow: 'hidden'
                    }}
                  >
                    <div style={{ padding: '8px 12px', fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border-subtle)' }}>
                      Switch Demonstration Role
                    </div>
                    {PERSONAS.map(p => (
                      <button
                        key={p.email}
                        type="button"
                        onClick={() => {
                          onSelectPersona(p.email, p.pass);
                          setShowPersonaMenu(false);
                        }}
                        style={{
                          width: '100%',
                          textAlign: 'left',
                          padding: '8px 12px',
                          background: user.email === p.email ? 'var(--bg-subtle)' : 'transparent',
                          border: 'none',
                          borderBottom: '1px solid var(--border-subtle)',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 2
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)' }}>{p.name}</span>
                          <span className="badge badge-cyan" style={{ fontSize: '0.6rem' }}>{p.role}</span>
                        </div>
                        <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{p.email}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Current User Badge */}
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {user.full_name.replace(/24BCE\d+/gi, '').replace(/\s*\(\s*\)/g, '').replace(/\s+/g, ' ').trim()}
                </div>
                <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end', marginTop: 1 }}>
                  {user.roles.map(r => (
                    <span key={r} className="badge badge-emerald" style={{ fontSize: '0.58rem', padding: '1px 4px' }}>{r}</span>
                  ))}
                </div>
              </div>

              <button onClick={onLogout} className="btn btn-secondary" style={{ padding: '5px 7px', borderRadius: 'var(--radius-sm)' }} title="Sign Out">
                <LogOut size={13} color="var(--color-danger)" />
              </button>
            </div>
          ) : (
            <button onClick={onOpenLogin} className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '0.75rem' }}>
              <Lock size={12} />
              Sign In
            </button>
          )}

        </div>

      </div>
    </header>
  );
};
