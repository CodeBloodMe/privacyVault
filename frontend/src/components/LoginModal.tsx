import React, { useState } from 'react';
import { X, Key } from 'lucide-react';
import { api } from '../services/api';
import { UserProfile } from '../types/api';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: UserProfile) => void;
}

const PRELOADED_ACCOUNTS = [
  {
    role: 'ANALYST 1',
    name: 'Krish (Lead Epidemiologist)',
    email: 'krish.24bce0846@vitstudent.ac.in',
    password: 'AnalystPass2026!',
    badgeColor: 'badge-cyan',
    desc: 'Authorized researcher submitting aggregate DP queries'
  },
  {
    role: 'ANALYST 2',
    name: 'Parv (Biostatistician)',
    email: 'parv.24bce0870@vitstudent.ac.in',
    password: 'AnalystPass2026!',
    badgeColor: 'badge-cyan',
    desc: 'Secondary analyst evaluating collaborative privacy budgets'
  },
  {
    role: 'DATA OWNER',
    name: 'Dr. V. Sivakumar (Chief Data Officer)',
    email: 'dr.sivakumar@vit.ac.in',
    password: 'OwnerPass2026!',
    badgeColor: 'badge-emerald',
    desc: 'Dataset custodian governing privacy policies & access grants'
  },
  {
    role: 'AUDITOR',
    name: 'Lead Compliance Auditor',
    email: 'compliance.auditor@vit.ac.in',
    password: 'AuditorPass2026!',
    badgeColor: 'badge-violet',
    desc: 'Inspects immutable budget ledger & security audit events'
  },
  {
    role: 'ADMIN',
    name: 'System Administrator',
    email: 'admin@privacyvault.local',
    password: 'AdminPass2026!',
    badgeColor: 'badge-amber',
    desc: 'Global user administration and database infrastructure'
  }
];

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose, onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleLogin = async (e?: React.FormEvent, customEmail?: string, customPass?: string) => {
    if (e) e.preventDefault();
    const loginEmail = customEmail || email;
    const loginPass = customPass || password;

    setLoading(true);
    setError(null);

    try {
      const res = await api.login(loginEmail, loginPass);
      localStorage.setItem('pv_user', JSON.stringify(res.user));
      onLoginSuccess(res.user);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)' }}>
      <div className="glass-panel" style={{ width: '100%', maxWidth: 560, padding: 24, position: 'relative', boxShadow: 'var(--shadow-dropdown)' }}>
        
        {/* Close Button */}
        <button onClick={onClose} style={{ position: 'absolute', top: 16, right: 16, background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
          <X size={18} />
        </button>

        {/* Modal Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
          <div style={{ width: 40, height: 40, borderRadius: 'var(--radius-md)', background: 'var(--bg-info)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border-info)' }}>
            <Key size={20} color="var(--color-info)" />
          </div>
          <div>
            <h2 style={{ fontSize: '1.15rem' }}>Select Persona or Sign In</h2>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>PostgreSQL single users table with role-based access control</p>
          </div>
        </div>

        {/* Preloaded 1-Click Role Switcher */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>
            1-Click Assessment Demonstration Roles
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {PRELOADED_ACCOUNTS.map((acc) => (
              <button
                key={acc.email}
                type="button"
                onClick={() => {
                  setEmail(acc.email);
                  setPassword(acc.password);
                  handleLogin(undefined, acc.email, acc.password);
                }}
                disabled={loading}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '9px 12px',
                  background: 'var(--bg-subtle)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#e2e8f0';
                  e.currentTarget.style.borderColor = 'var(--border-strong)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'var(--bg-subtle)';
                  e.currentTarget.style.borderColor = 'var(--border-subtle)';
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontWeight: 600, fontSize: '0.825rem', color: 'var(--text-primary)' }}>{acc.name}</span>
                    <span className={`badge ${acc.badgeColor}`} style={{ fontSize: '0.6rem' }}>{acc.role}</span>
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>{acc.desc}</div>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--accent-primary)', fontWeight: 600 }}>Login →</div>
              </button>
            ))}
          </div>
        </div>

        {/* Divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '16px 0' }}>
          <div style={{ flex: 1, height: 1, background: 'var(--border-subtle)' }} />
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>or manual credentials</span>
          <div style={{ flex: 1, height: 1, background: 'var(--border-subtle)' }} />
        </div>

        {error && (
          <div style={{ padding: '8px 12px', background: 'var(--bg-danger)', border: '1px solid var(--border-danger)', borderRadius: 'var(--radius-md)', color: 'var(--color-danger)', fontSize: '0.78rem', marginBottom: 14 }}>
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>Email Address</label>
            <input
              type="email"
              className="form-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. researcher@medical-center.org"
              required
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>Password</label>
            <input
              type="password"
              className="form-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              required
            />
          </div>

          <button type="submit" disabled={loading} className="btn btn-primary" style={{ marginTop: 4 }}>
            {loading ? 'Authenticating...' : 'Sign In with JWT'}
          </button>
        </form>

      </div>
    </div>
  );
};
