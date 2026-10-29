import React, { useState, useEffect } from 'react';
import { ShieldCheck, FileText, RefreshCw, Lock, AlertTriangle } from 'lucide-react';
import { api } from '../services/api';
import { AuditEvent, LedgerEntry, BudgetSummary } from '../types/api';

export const AuditorConsole: React.FC = () => {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [budgets, setBudgets] = useState<BudgetSummary[]>([]);
  const [selectedBudgetId, setSelectedBudgetId] = useState<string>('');
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [eventTypeFilter, setEventTypeFilter] = useState<string>('');
  const [outcomeFilter, setOutcomeFilter] = useState<string>('');

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [evs, bSummaries] = await Promise.all([
        api.getAuditEvents(eventTypeFilter || undefined, outcomeFilter || undefined),
        api.getAllBudgetSummaries()
      ]);
      setEvents(evs);
      setBudgets(bSummaries);
      if (bSummaries.length > 0 && !selectedBudgetId) {
        setSelectedBudgetId(bSummaries[0].budget_id);
      }
    } catch (err: any) {
      console.error('Failed to load audit telemetry:', err);
      setError(err.message || 'Failed to retrieve compliance audit telemetry from PostgreSQL.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [eventTypeFilter, outcomeFilter]);

  // Load ledger for selected budget
  useEffect(() => {
    if (selectedBudgetId) {
      api.getBudgetLedger(selectedBudgetId).then(setLedgerEntries).catch(console.error);
    }
  }, [selectedBudgetId]);

  if (loading) {
    return (
      <div style={{ maxWidth: 1400, margin: '80px auto', padding: '0 20px', textAlign: 'center' }}>
        <div className="glass-panel" style={{ padding: '48px 32px', maxWidth: 480, margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <RefreshCw size={32} color="var(--color-purple)" className="animate-spin" />
          <div>
            <h3 style={{ fontSize: '1.1rem', color: 'var(--text-primary)', marginBottom: 6 }}>Loading Audit Telemetry</h3>
            <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)' }}>
              Retrieving verifiable database events and immutable ledger entries from PostgreSQL 17...
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
            {isAuthError ? 'Authentication Required' : 'Auditor Console Error'}
          </h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 20 }}>
            {isAuthError
              ? 'Your active session has expired or requires authentication. Please sign in to access compliance audit logs.'
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '1.3rem', display: 'flex', alignItems: 'center', gap: 10 }}>
            <ShieldCheck size={20} color="var(--color-purple)" />
            Compliance Audit & Immutable Ledger Console
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: 4 }}>
            Inspecting verifiable database events, security decisions, and append-only ledger entries
          </p>
        </div>

        <button onClick={loadData} className="btn btn-secondary" style={{ padding: '6px 14px', fontSize: '0.78rem' }}>
          <RefreshCw size={13} /> Refresh Logs
        </button>
      </div>

      {/* Append-Only Ledger Section */}
      <div className="glass-panel" style={{ padding: 22, borderTop: '4px solid var(--accent-primary)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h3 style={{ fontSize: '1rem', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Lock size={16} color="var(--accent-primary)" />
              Immutable Financial-Grade Budget Ledger (PostgreSQL Trigger Protected)
            </h3>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 }}>
              Protected by trigger <code>tr_enforce_append_only_ledger</code> — zero UPDATE or DELETE allowed.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Target Budget:</span>
            <select
              className="form-select"
              style={{ width: 'auto', fontSize: '0.8rem' }}
              value={selectedBudgetId}
              onChange={(e) => setSelectedBudgetId(e.target.value)}
            >
              {budgets.map((b) => (
                <option key={b.budget_id} value={b.budget_id}>
                  {b.analyst_name} ({b.dataset_name})
                </option>
              ))}
            </select>
          </div>
        </div>

        {ledgerEntries.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: '0.825rem' }}>
            No ledger entries found for this budget.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Transaction Type</th>
                  <th>Amount (ε)</th>
                  <th>Balance After</th>
                  <th>Request ID</th>
                  <th>Timestamp</th>
                  <th>Integrity</th>
                </tr>
              </thead>
              <tbody>
                {ledgerEntries.map((entry) => (
                  <tr key={entry.id}>
                    <td>
                      <span className={`badge ${entry.transaction_type === 'ALLOCATION' ? 'badge-cyan' : entry.transaction_type === 'RESERVATION' ? 'badge-violet' : 'badge-emerald'}`}>
                        {entry.transaction_type}
                      </span>
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: entry.amount > 0 ? 'var(--accent-primary)' : 'var(--text-muted)' }}>
                      {entry.transaction_type === 'RESERVATION' ? `-${entry.amount}` : `+${entry.amount}`} ε
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                      {entry.balance_after} ε
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      {entry.request_id || 'SYSTEM_ALLOCATION'}
                    </td>
                    <td style={{ color: 'var(--text-muted)' }}>
                      {new Date(entry.created_at).toLocaleString()}
                    </td>
                    <td>
                      <span className="badge badge-emerald" style={{ fontSize: '0.65rem' }}>Append-Only</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Filterable Audit Events Section */}
      <div className="glass-panel" style={{ padding: 22 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 12 }}>
          <h3 style={{ fontSize: '1rem', display: 'flex', alignItems: 'center', gap: 8 }}>
            <FileText size={16} color="var(--color-purple)" />
            Security & Compliance Event Log (Analytical View: v_audit_summary_log)
          </h3>

          {/* Filter Controls */}
          <div style={{ display: 'flex', gap: 10 }}>
            <select
              className="form-select"
              style={{ width: 'auto', fontSize: '0.78rem' }}
              value={eventTypeFilter}
              onChange={(e) => setEventTypeFilter(e.target.value)}
            >
              <option value="">All Event Types</option>
              <option value="AUTH_LOGIN_SUCCESS">AUTH_LOGIN_SUCCESS</option>
              <option value="AUTH_LOGIN_FAILED">AUTH_LOGIN_FAILED</option>
              <option value="QUERY_RELEASED">QUERY_RELEASED</option>
              <option value="QUERY_REJECTED">QUERY_REJECTED</option>
              <option value="BUDGET_EXHAUSTION_DENIED">BUDGET_EXHAUSTION_DENIED</option>
              <option value="GRANT_ISSUED">GRANT_ISSUED</option>
              <option value="GRANT_REVOKED">GRANT_REVOKED</option>
            </select>

            <select
              className="form-select"
              style={{ width: 'auto', fontSize: '0.78rem' }}
              value={outcomeFilter}
              onChange={(e) => setOutcomeFilter(e.target.value)}
            >
              <option value="">All Outcomes</option>
              <option value="SUCCESS">SUCCESS</option>
              <option value="DENIED">DENIED</option>
              <option value="ERROR">ERROR</option>
            </select>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Outcome</th>
                <th>Event Type</th>
                <th>Actor</th>
                <th>Resource</th>
                <th>Context Details</th>
              </tr>
            </thead>
            <tbody>
              {events.map((ev) => (
                <tr key={ev.id}>
                  <td style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    {new Date(ev.event_timestamp).toLocaleTimeString()}
                  </td>
                  <td>
                    <span className={`badge ${ev.outcome === 'SUCCESS' ? 'badge-emerald' : ev.outcome === 'DENIED' ? 'badge-rose' : 'badge-amber'}`}>
                      {ev.outcome}
                    </span>
                  </td>
                  <td style={{ fontWeight: 600 }}>
                    {ev.event_type}
                  </td>
                  <td>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{ev.actor_name || 'System / Anonymous'}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{ev.actor_email}</div>
                  </td>
                  <td style={{ color: 'var(--text-secondary)' }}>
                    {ev.resource_type || '—'}
                  </td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--accent-primary)', maxWidth: 360, wordBreak: 'break-all' }}>
                    {JSON.stringify(ev.details)}
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
