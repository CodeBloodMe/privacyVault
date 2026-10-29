import React, { useState, useEffect } from 'react';
import { UserCheck, Shield, Plus, Ban, RefreshCw, AlertTriangle } from 'lucide-react';
import { api } from '../services/api';
import { Dataset, BudgetSummary } from '../types/api';

export const DataOwnerPortal: React.FC = () => {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [budgetSummaries, setBudgetSummaries] = useState<BudgetSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [analystEmail, setAnalystEmail] = useState('');
  const [expiresInDays, setExpiresInDays] = useState(30);
  const [allocatedEpsilon, setAllocatedEpsilon] = useState(5.0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formMsg, setFormMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [ds, bSummaries] = await Promise.all([
        api.listDatasets(),
        api.getAllBudgetSummaries()
      ]);
      setDatasets(ds);
      setBudgetSummaries(bSummaries);
    } catch (err: any) {
      console.error('Failed to load governance telemetry:', err);
      setError(err.message || 'Failed to retrieve governance telemetry from PostgreSQL.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleIssueGrant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!datasets[0]) return;
    setIsSubmitting(true);
    setFormMsg(null);
    try {
      await api.issueGrant({
        dataset_id: datasets[0].id,
        analyst_email: analystEmail,
        expires_in_days: expiresInDays,
        allocated_epsilon: allocatedEpsilon
      });
      setFormMsg({ text: `Grant successfully issued to ${analystEmail} with ${allocatedEpsilon} ε budget.`, type: 'success' });
      setAnalystEmail('');
      await loadData();
    } catch (err: any) {
      setFormMsg({ text: err.message || 'Failed to issue grant', type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRevokeGrant = async (grantId: string) => {
    try {
      await api.revokeGrant(grantId);
      await loadData();
    } catch (err: any) {
      alert(`Failed to revoke grant: ${err.message}`);
    }
  };

  if (loading) {
    return (
      <div style={{ maxWidth: 1400, margin: '80px auto', padding: '0 20px', textAlign: 'center' }}>
        <div className="glass-panel" style={{ padding: '48px 32px', maxWidth: 480, margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <RefreshCw size={32} color="var(--color-success)" className="animate-spin" />
          <div>
            <h3 style={{ fontSize: '1.1rem', color: 'var(--text-primary)', marginBottom: 6 }}>Loading Governance Telemetry</h3>
            <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)' }}>
              Retrieving active datasets and privacy budgets from PostgreSQL 17...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    const isAuthError = !api.getToken() || error.toLowerCase().includes('authenticated') || error.toLowerCase().includes('credentials');

    return (
      <div style={{ maxWidth: 1400, margin: '60px auto', padding: '0 20px' }}>
        <div className="glass-panel" style={{ padding: '36px', maxWidth: 560, margin: '0 auto', textAlign: 'center', borderLeft: '4px solid var(--color-danger)' }}>
          <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--bg-danger)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
            <AlertTriangle size={24} color="var(--color-danger)" />
          </div>
          <h3 style={{ fontSize: '1.15rem', marginBottom: 8, color: 'var(--color-danger)' }}>
            {isAuthError ? 'Authentication Required' : 'Governance Portal Error'}
          </h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 20 }}>
            {isAuthError
              ? 'Your active session has expired or requires authentication. Please sign in to access data governance.'
              : error}
          </p>
          {isAuthError ? (
            <button
              onClick={() => {
                api.logout();
                window.dispatchEvent(new CustomEvent('pv_session_expired'));
              }}
              className="btn btn-primary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
            >
              Sign In with 1-Click Role Switcher
            </button>
          ) : (
            <button onClick={loadData} className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <RefreshCw size={14} />
              Retry Connection
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: 24 }}>
      
      {/* Header */}
      <div>
        <h2 style={{ fontSize: '1.3rem', display: 'flex', alignItems: 'center', gap: 10 }}>
          <Shield size={20} color="var(--color-success)" />
          Data Custodian Governance Portal
        </h2>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: 4 }}>
          Manage differential privacy policies, analyst access grants, and revocations
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 24 }}>
        
        {/* Issue Grant Form */}
        <div className="glass-panel" style={{ padding: 22 }}>
          <h3 style={{ fontSize: '1rem', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Plus size={16} color="var(--color-success)" />
            Issue Analyst Access Grant
          </h3>

          {formMsg && (
            <div style={{ padding: '10px 14px', borderRadius: 'var(--radius-md)', fontSize: '0.825rem', marginBottom: 14, background: formMsg.type === 'success' ? 'var(--bg-success)' : 'var(--bg-danger)', color: formMsg.type === 'success' ? 'var(--color-success)' : 'var(--color-danger)', border: `1px solid ${formMsg.type === 'success' ? 'var(--border-success)' : 'var(--border-danger)'}` }}>
              {formMsg.text}
            </div>
          )}

          <form onSubmit={handleIssueGrant} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>Target Protected Dataset</label>
              <select className="form-select" disabled>
                {datasets.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>Analyst Email</label>
              <input
                type="email"
                className="form-input"
                placeholder="e.g. researcher@medical-center.org"
                value={analystEmail}
                onChange={(e) => setAnalystEmail(e.target.value)}
                required
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>Grant Duration (Days)</label>
                <input
                  type="number"
                  className="form-input"
                  min="1"
                  max="365"
                  value={expiresInDays}
                  onChange={(e) => setExpiresInDays(parseInt(e.target.value) || 30)}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>Allocated Budget (ε)</label>
                <input
                  type="number"
                  className="form-input"
                  min="0.5"
                  max="20"
                  step="0.5"
                  value={allocatedEpsilon}
                  onChange={(e) => setAllocatedEpsilon(parseFloat(e.target.value) || 5.0)}
                />
              </div>
            </div>

            <button type="submit" disabled={isSubmitting} className="btn btn-primary" style={{ marginTop: 6 }}>
              {isSubmitting ? 'Recording Grant in PostgreSQL...' : 'Authorize Grant & Allocate Budget'}
            </button>
          </form>
        </div>

        {/* Policy Summary Card */}
        <div className="glass-panel" style={{ padding: 22, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-success)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Active Governance Constraints
              </span>
              <span className="badge badge-emerald">Enforced</span>
            </div>
            <h3 style={{ fontSize: '1rem', marginBottom: 10 }}>Zero-Trust Access Invariants</h3>
            <ul style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', lineHeight: 1.8, paddingLeft: 18 }}>
              <li>Direct <code>SELECT</code> on raw patient records blocked via restricted runtime role.</li>
              <li>Every aggregate query checks for active, non-expired dataset grant.</li>
              <li>Per-query ε capped at 1.0; global cap enforced via database check constraints.</li>
              <li>Atomic row-locking prevents concurrent overspending races.</li>
              <li>Differencing detector halts overlapping queries before private data processing.</li>
            </ul>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border-subtle)', paddingTop: 12, marginTop: 16 }}>
            Compliance Verification: Continuous Automated Auditing Active
          </div>
        </div>

      </div>

      {/* Active Grants & Real-time Budget Summaries */}
      <div className="glass-panel" style={{ padding: 22 }}>
        <h3 style={{ fontSize: '1rem', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
          <UserCheck size={16} color="var(--color-success)" />
          Active Analyst Grants & Real-time Privacy Budget Balances
        </h3>

        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Analyst</th>
                <th>Dataset</th>
                <th>Budget Remaining</th>
                <th>Utilization</th>
                <th>Expiration</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {budgetSummaries.map((b) => (
                <tr key={b.grant_id}>
                  <td>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{b.analyst_name}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{b.analyst_email}</div>
                  </td>
                  <td>{b.dataset_name}</td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent-primary)' }}>
                    {b.remaining_epsilon} / {b.total_epsilon} ε
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 60, height: 6, background: 'var(--bg-muted)', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${b.budget_utilization_pct}%`, background: 'var(--accent-primary)' }} />
                      </div>
                      <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)' }}>{b.budget_utilization_pct}%</span>
                    </div>
                  </td>
                  <td style={{ color: 'var(--text-muted)' }}>
                    {new Date(b.expires_at).toLocaleDateString()}
                  </td>
                  <td>
                    <span className={`badge ${b.grant_active ? 'badge-emerald' : 'badge-rose'}`}>
                      {b.grant_active ? 'Active' : 'Revoked'}
                    </span>
                  </td>
                  <td>
                    {b.grant_active ? (
                      <button
                        onClick={() => handleRevokeGrant(b.grant_id)}
                        className="btn btn-danger"
                        style={{ padding: '3px 8px', fontSize: '0.72rem' }}
                      >
                        <Ban size={12} /> Revoke
                      </button>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>Revoked</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
