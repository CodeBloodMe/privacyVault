import React, { useState, useEffect } from 'react';
import { Database, Layers, RefreshCw, AlertTriangle, Network, Key, Link2, Copy, Check, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { api } from '../services/api';
import { Dataset } from '../types/api';

const MERMAID_ER_CODE = `erDiagram
    USERS ||--o{ USER_ROLES : "assigned"
    ROLES ||--o{ USER_ROLES : "comprises"
    
    USERS ||--o{ DATASETS : "owns"
    DATASETS ||--|{ DATASET_COLUMNS : "defines"
    DATASETS ||--|| PRIVACY_POLICIES : "governed_by"
    
    USERS ||--o{ DATASET_GRANTS : "granted_to"
    DATASETS ||--o{ DATASET_GRANTS : "authorizes"
    
    DATASET_GRANTS ||--|| PRIVACY_BUDGETS : "allocates"
    PRIVACY_BUDGETS ||--o{ PRIVACY_BUDGET_LEDGER : "audited_by"
    
    DATASET_GRANTS ||--o{ QUERY_REQUESTS : "initiates"
    QUERY_REQUESTS ||--o| QUERY_RELEASES : "produces"
    QUERY_REQUESTS ||--o{ PRIVACY_BUDGET_LEDGER : "debits"
    
    USERS ||--o{ AUDIT_EVENTS : "triggers"
    DATASETS ||--o{ PROTECTED_PATIENTS : "protects"

    USERS {
        UUID id PK
        VARCHAR email UK
        VARCHAR password_hash
        VARCHAR full_name
        BOOLEAN is_active
        TIMESTAMPTZ created_at
    }

    ROLES {
        VARCHAR name PK
        VARCHAR description
    }

    USER_ROLES {
        UUID user_id PK, FK
        VARCHAR role_name PK, FK
        TIMESTAMPTZ assigned_at
    }

    DATASETS {
        UUID id PK
        VARCHAR name UK
        TEXT description
        VARCHAR target_table
        UUID owner_id FK
        BOOLEAN is_active
    }

    DATASET_COLUMNS {
        UUID id PK
        UUID dataset_id FK
        VARCHAR column_name
        VARCHAR data_type
        BOOLEAN is_sensitive
        BOOLEAN is_identifier
        BOOLEAN is_aggregatable
        NUMERIC min_bound
        NUMERIC max_bound
    }

    PRIVACY_POLICIES {
        UUID id PK
        UUID dataset_id FK
        NUMERIC max_epsilon_per_query
        NUMERIC global_epsilon_cap
        NUMERIC sensitivity_clamp_low
        NUMERIC sensitivity_clamp_high
        VARCHAR approved_mechanisms
    }

    DATASET_GRANTS {
        UUID id PK
        UUID dataset_id FK
        UUID analyst_id FK
        UUID granted_by FK
        TIMESTAMPTZ granted_at
        TIMESTAMPTZ expires_at
        BOOLEAN is_active
    }

    PRIVACY_BUDGETS {
        UUID id PK
        UUID grant_id UK, FK
        NUMERIC total_epsilon
        NUMERIC remaining_epsilon
        NUMERIC total_delta
        NUMERIC remaining_delta
    }

    PRIVACY_BUDGET_LEDGER {
        UUID id PK
        UUID budget_id FK
        UUID request_id FK
        NUMERIC amount
        VARCHAR transaction_type
        NUMERIC balance_after
        TIMESTAMPTZ created_at
    }

    QUERY_REQUESTS {
        UUID id PK
        UUID grant_id FK
        UUID analyst_id FK
        VARCHAR metric
        VARCHAR target_column
        JSONB filter_criteria
        NUMERIC requested_epsilon
        VARCHAR status
        VARCHAR risk_level
    }

    QUERY_RELEASES {
        UUID id PK
        UUID request_id UK, FK
        NUMERIC noisy_result
        VARCHAR mechanism_used
        NUMERIC noise_scale
        NUMERIC sensitivity_applied
        NUMERIC epsilon_spent
        TIMESTAMPTZ released_at
    }

    AUDIT_EVENTS {
        UUID id PK
        TIMESTAMPTZ event_timestamp
        UUID actor_user_id FK
        VARCHAR event_type
        VARCHAR outcome
        VARCHAR client_ip
        JSONB details
    }

    PROTECTED_PATIENTS {
        UUID patient_id PK
        VARCHAR mrn UK
        INTEGER age
        VARCHAR gender
        VARCHAR blood_group
        VARCHAR diagnosis_code
        VARCHAR admission_type
        NUMERIC treatment_cost
        INTEGER length_of_stay_days
        BOOLEAN readmitted
    }`;

export const DatasetExplorer: React.FC = () => {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [selectedDataset, setSelectedDataset] = useState<Dataset | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'catalog' | 'er_diagram'>('er_diagram');
  const [copiedMermaid, setCopiedMermaid] = useState(false);

  const loadCatalog = async () => {
    setLoading(true);
    setError(null);
    try {
      const ds = await api.listDatasets();
      setDatasets(ds);
      if (ds.length > 0) {
        setSelectedDataset(prev => (prev ? ds.find(d => d.id === prev.id) || ds[0] : ds[0]));
      } else {
        setSelectedDataset(null);
      }
    } catch (err: any) {
      console.error('Failed to load dataset catalog:', err);
      setError(err.message || 'Unable to load dataset metadata catalog. Please verify your connection.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCatalog();
  }, []);

  const handleCopyMermaid = () => {
    navigator.clipboard.writeText(MERMAID_ER_CODE);
    setCopiedMermaid(true);
    setTimeout(() => setCopiedMermaid(false), 2000);
  };

  if (loading) {
    return (
      <div style={{ maxWidth: 1400, margin: '80px auto', padding: '0 20px', textAlign: 'center' }}>
        <div className="glass-panel" style={{ padding: '48px 32px', maxWidth: 480, margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <RefreshCw size={32} color="var(--accent-primary)" className="animate-spin" />
          <div>
            <h3 style={{ fontSize: '1.1rem', color: 'var(--text-primary)', marginBottom: 6 }}>Loading Metadata Catalog</h3>
            <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)' }}>
              Querying approved schema definitions from PostgreSQL 17 view <code>v_dataset_metadata_catalog</code>...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ maxWidth: 1400, margin: '60px auto', padding: '0 20px' }}>
        <div className="glass-panel" style={{ padding: '36px', maxWidth: 560, margin: '0 auto', textAlign: 'center', borderLeft: '4px solid var(--color-danger)' }}>
          <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--bg-danger)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
            <AlertTriangle size={24} color="var(--color-danger)" />
          </div>
          <h3 style={{ fontSize: '1.15rem', marginBottom: 8, color: 'var(--color-danger)' }}>
            Database Metadata Unavailable
          </h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 20 }}>
            {error}
          </p>
          <button onClick={loadCatalog} className="btn btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <RefreshCw size={14} />
            Refresh Catalog
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: 24 }}>
      
      {/* Header with View Mode Switcher */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: '1.3rem', display: 'flex', alignItems: 'center', gap: 10 }}>
            <Database size={20} color="var(--accent-primary)" />
            Relational Schema & Metadata Architecture
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: 4 }}>
            PostgreSQL 17 Normalized 3NF Architecture • 13 Relational Tables • Differential Privacy Governance
          </p>
        </div>
        
        {/* Toggle between ER Diagram & Column Catalog */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ display: 'inline-flex', padding: 3, background: 'var(--bg-subtle)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
            <button
              type="button"
              onClick={() => setViewMode('er_diagram')}
              className={viewMode === 'er_diagram' ? 'btn btn-primary' : 'btn btn-secondary'}
              style={{ padding: '6px 14px', fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: 6, border: 'none' }}
            >
              <Network size={13} />
              Interactive 3NF ER Diagram
            </button>
            <button
              type="button"
              onClick={() => setViewMode('catalog')}
              className={viewMode === 'catalog' ? 'btn btn-primary' : 'btn btn-secondary'}
              style={{ padding: '6px 14px', fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: 6, border: 'none' }}
            >
              <Layers size={13} />
              Dataset Columns & Policies
            </button>
          </div>

          <button
            onClick={loadCatalog}
            className="btn btn-secondary"
            title="Refresh schema from PostgreSQL"
            style={{ padding: '6px 12px', fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <RefreshCw size={13} />
            Refresh
          </button>
        </div>
      </div>

      {/* VIEW 1: INTERACTIVE 3NF ER DIAGRAM */}
      {viewMode === 'er_diagram' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          
          {/* Top Banner with Copy Button */}
          <div className="glass-panel" style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className="badge badge-emerald">3NF Validated</span>
              <span className="badge badge-violet">PostgreSQL 17 DDL</span>
              <span className="badge badge-cyan">Crow's Foot Notation</span>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                13 Normalized Tables • 0 Transitive Dependencies • Strict Referential Integrity (ON DELETE RESTRICT/CASCADE)
              </span>
            </div>
            <button
              type="button"
              onClick={handleCopyMermaid}
              className="btn btn-secondary"
              style={{ fontSize: '0.75rem', padding: '6px 12px', display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              {copiedMermaid ? <Check size={13} color="var(--color-success)" /> : <Copy size={13} />}
              {copiedMermaid ? 'Copied Mermaid Code!' : 'Copy Mermaid ER Code'}
            </button>
          </div>

          {/* Architecture Cluster Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 20 }}>
            
            {/* Cluster 1: Identity & RBAC */}
            <div className="glass-panel" style={{ padding: 20, borderTop: '3px solid var(--accent-primary)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <ShieldCheck size={16} color="var(--accent-primary)" />
                  1. Identity & RBAC Cluster
                </h3>
                <span className="badge badge-cyan">3 Tables</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ background: 'var(--bg-subtle)', padding: 12, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '0.82rem' }}>
                    <span>users</span>
                    <span className="badge badge-emerald" style={{ fontSize: '0.58rem' }}>1NF / 2NF / 3NF</span>
                  </div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginTop: 4, fontFamily: 'var(--font-mono)' }}>
                    <div><span style={{ color: 'var(--color-warning)', fontWeight: 600 }}>PK</span> id: UUID</div>
                    <div><span style={{ color: 'var(--color-success)', fontWeight: 600 }}>UK</span> email: VARCHAR(255)</div>
                    <div>password_hash, full_name, is_active, created_at</div>
                  </div>
                </div>

                <div style={{ background: 'var(--bg-subtle)', padding: 12, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '0.82rem' }}>
                    <span>roles</span>
                    <span className="badge badge-emerald" style={{ fontSize: '0.58rem' }}>Lookup Table</span>
                  </div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginTop: 4, fontFamily: 'var(--font-mono)' }}>
                    <div><span style={{ color: 'var(--color-warning)', fontWeight: 600 }}>PK</span> name: VARCHAR(50)</div>
                    <div>description: TEXT</div>
                  </div>
                </div>

                <div style={{ background: 'var(--bg-subtle)', padding: 12, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '0.82rem' }}>
                    <span>user_roles</span>
                    <span className="badge badge-violet" style={{ fontSize: '0.58rem' }}>Junction M:N</span>
                  </div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginTop: 4, fontFamily: 'var(--font-mono)' }}>
                    <div><span style={{ color: 'var(--color-warning)', fontWeight: 600 }}>PK/FK</span> user_id → users(id)</div>
                    <div><span style={{ color: 'var(--color-warning)', fontWeight: 600 }}>PK/FK</span> role_name → roles(name)</div>
                    <div>assigned_at: TIMESTAMPTZ</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Cluster 2: Data Governance & Privacy Policies */}
            <div className="glass-panel" style={{ padding: 20, borderTop: '3px solid var(--color-purple)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Database size={16} color="var(--color-purple)" />
                  2. Dataset Governance Cluster
                </h3>
                <span className="badge badge-violet">3 Tables</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ background: 'var(--bg-subtle)', padding: 12, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '0.82rem' }}>
                    <span>datasets</span>
                    <span className="badge badge-emerald" style={{ fontSize: '0.58rem' }}>Parent (1:N)</span>
                  </div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginTop: 4, fontFamily: 'var(--font-mono)' }}>
                    <div><span style={{ color: 'var(--color-warning)', fontWeight: 600 }}>PK</span> id: UUID</div>
                    <div><span style={{ color: 'var(--color-success)', fontWeight: 600 }}>UK</span> name: VARCHAR(100)</div>
                    <div><span style={{ color: 'var(--color-info)', fontWeight: 600 }}>FK</span> owner_id → users(id)</div>
                    <div>target_table: VARCHAR, is_active: BOOLEAN</div>
                  </div>
                </div>

                <div style={{ background: 'var(--bg-subtle)', padding: 12, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '0.82rem' }}>
                    <span>dataset_columns</span>
                    <span className="badge badge-cyan" style={{ fontSize: '0.58rem' }}>Child (N:1)</span>
                  </div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginTop: 4, fontFamily: 'var(--font-mono)' }}>
                    <div><span style={{ color: 'var(--color-warning)', fontWeight: 600 }}>PK</span> id: UUID</div>
                    <div><span style={{ color: 'var(--color-info)', fontWeight: 600 }}>FK</span> dataset_id → datasets(id)</div>
                    <div>column_name, data_type, is_sensitive, min_bound, max_bound</div>
                  </div>
                </div>

                <div style={{ background: 'var(--bg-subtle)', padding: 12, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '0.82rem' }}>
                    <span>privacy_policies</span>
                    <span className="badge badge-amber" style={{ fontSize: '0.58rem' }}>DP Bounds (1:1)</span>
                  </div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginTop: 4, fontFamily: 'var(--font-mono)' }}>
                    <div><span style={{ color: 'var(--color-warning)', fontWeight: 600 }}>PK</span> id: UUID</div>
                    <div><span style={{ color: 'var(--color-info)', fontWeight: 600 }}>FK</span> dataset_id → datasets(id)</div>
                    <div>max_epsilon_per_query, global_epsilon_cap, sensitivity_clamp_low, high</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Cluster 3: Privacy Budget Ledger & Authorizations */}
            <div className="glass-panel" style={{ padding: 20, borderTop: '3px solid var(--color-emerald)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Key size={16} color="var(--color-emerald)" />
                  3. Privacy Budget & Ledger Cluster
                </h3>
                <span className="badge badge-emerald">3 Tables</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ background: 'var(--bg-subtle)', padding: 12, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '0.82rem' }}>
                    <span>dataset_grants</span>
                    <span className="badge badge-emerald" style={{ fontSize: '0.58rem' }}>Authorization</span>
                  </div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginTop: 4, fontFamily: 'var(--font-mono)' }}>
                    <div><span style={{ color: 'var(--color-warning)', fontWeight: 600 }}>PK</span> id: UUID</div>
                    <div><span style={{ color: 'var(--color-info)', fontWeight: 600 }}>FK</span> dataset_id → datasets(id)</div>
                    <div><span style={{ color: 'var(--color-info)', fontWeight: 600 }}>FK</span> analyst_id → users(id), granted_by → users(id)</div>
                    <div>granted_at, expires_at, is_active</div>
                  </div>
                </div>

                <div style={{ background: 'var(--bg-subtle)', padding: 12, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '0.82rem' }}>
                    <span>privacy_budgets</span>
                    <span className="badge badge-amber" style={{ fontSize: '0.58rem' }}>Row-Locked</span>
                  </div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginTop: 4, fontFamily: 'var(--font-mono)' }}>
                    <div><span style={{ color: 'var(--color-warning)', fontWeight: 600 }}>PK</span> id: UUID</div>
                    <div><span style={{ color: 'var(--color-success)', fontWeight: 600 }}>UK/FK</span> grant_id → dataset_grants(id)</div>
                    <div>total_epsilon, remaining_epsilon, total_delta, remaining_delta</div>
                  </div>
                </div>

                <div style={{ background: 'var(--bg-subtle)', padding: 12, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '0.82rem' }}>
                    <span>privacy_budget_ledger</span>
                    <span className="badge badge-rose" style={{ fontSize: '0.58rem' }}>Append-Only Trigger</span>
                  </div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginTop: 4, fontFamily: 'var(--font-mono)' }}>
                    <div><span style={{ color: 'var(--color-warning)', fontWeight: 600 }}>PK</span> id: UUID</div>
                    <div><span style={{ color: 'var(--color-info)', fontWeight: 600 }}>FK</span> budget_id → privacy_budgets(id)</div>
                    <div><span style={{ color: 'var(--color-info)', fontWeight: 600 }}>FK</span> request_id → query_requests(id)</div>
                    <div>amount, transaction_type, balance_after, created_at</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Cluster 4: Query Engine & DP Releases */}
            <div className="glass-panel" style={{ padding: 20, borderTop: '3px solid var(--color-warning)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Link2 size={16} color="var(--color-warning)" />
                  4. Query & Release Cluster
                </h3>
                <span className="badge badge-amber">2 Tables</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ background: 'var(--bg-subtle)', padding: 12, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '0.82rem' }}>
                    <span>query_requests</span>
                    <span className="badge badge-emerald" style={{ fontSize: '0.58rem' }}>Query AST</span>
                  </div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginTop: 4, fontFamily: 'var(--font-mono)' }}>
                    <div><span style={{ color: 'var(--color-warning)', fontWeight: 600 }}>PK</span> id: UUID</div>
                    <div><span style={{ color: 'var(--color-info)', fontWeight: 600 }}>FK</span> grant_id → dataset_grants(id)</div>
                    <div><span style={{ color: 'var(--color-info)', fontWeight: 600 }}>FK</span> analyst_id → users(id)</div>
                    <div>metric, target_column, filter_criteria: JSONB, requested_epsilon, status</div>
                  </div>
                </div>

                <div style={{ background: 'var(--bg-subtle)', padding: 12, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '0.82rem' }}>
                    <span>query_releases</span>
                    <span className="badge badge-cyan" style={{ fontSize: '0.58rem' }}>DP Output (1:1)</span>
                  </div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginTop: 4, fontFamily: 'var(--font-mono)' }}>
                    <div><span style={{ color: 'var(--color-warning)', fontWeight: 600 }}>PK</span> id: UUID</div>
                    <div><span style={{ color: 'var(--color-success)', fontWeight: 600 }}>UK/FK</span> request_id → query_requests(id)</div>
                    <div>noisy_result, mechanism_used, noise_scale, sensitivity_applied, epsilon_spent</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Cluster 5: Protected Clinical Microdata (10,000 Records) */}
            <div className="glass-panel" style={{ padding: 20, borderTop: '3px solid var(--color-danger)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <ShieldCheck size={16} color="var(--color-danger)" />
                  5. Protected Microdata (Vault)
                </h3>
                <span className="badge badge-rose">10,000 Records</span>
              </div>
              <div style={{ background: 'var(--bg-subtle)', padding: 12, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '0.82rem' }}>
                  <span>protected_patients</span>
                  <span className="badge badge-rose" style={{ fontSize: '0.58rem' }}>RLS Protected</span>
                </div>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginTop: 4, fontFamily: 'var(--font-mono)' }}>
                  <div><span style={{ color: 'var(--color-warning)', fontWeight: 600 }}>PK</span> patient_id: UUID</div>
                  <div><span style={{ color: 'var(--color-success)', fontWeight: 600 }}>UK</span> mrn: VARCHAR(50) (Direct Identifier)</div>
                  <div>age: INT, gender: VARCHAR, blood_group: VARCHAR</div>
                  <div>diagnosis_code: VARCHAR (ICD-10 Index)</div>
                  <div>treatment_cost: NUMERIC [$500, $50000]</div>
                  <div>admission_type, readmitted, admission_date</div>
                </div>
                <div style={{ fontSize: '0.68rem', color: 'var(--color-danger)', marginTop: 8, fontWeight: 600 }}>
                  REVOKE ALL ON protected_patients FROM privacyvault_app;
                </div>
              </div>
            </div>

            {/* Cluster 6: Security Audit Log */}
            <div className="glass-panel" style={{ padding: 20, borderTop: '3px solid var(--color-violet)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <CheckCircle2 size={16} color="var(--color-violet)" />
                  6. Security & Audit Forensics
                </h3>
                <span className="badge badge-violet">Forensic Trail</span>
              </div>
              <div style={{ background: 'var(--bg-subtle)', padding: 12, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '0.82rem' }}>
                  <span>audit_events</span>
                  <span className="badge badge-emerald" style={{ fontSize: '0.58rem' }}>Indexed</span>
                </div>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginTop: 4, fontFamily: 'var(--font-mono)' }}>
                  <div><span style={{ color: 'var(--color-warning)', fontWeight: 600 }}>PK</span> id: UUID</div>
                  <div><span style={{ color: 'var(--color-info)', fontWeight: 600 }}>FK</span> actor_user_id → users(id)</div>
                  <div>event_timestamp: TIMESTAMPTZ (Index)</div>
                  <div>event_type, resource_type, outcome, client_ip, details: JSONB</div>
                </div>
              </div>
            </div>

          </div>

          {/* Relationships & Cardinality Table */}
          <div className="glass-panel" style={{ padding: 22 }}>
            <h3 style={{ fontSize: '1rem', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Network size={16} color="var(--accent-primary)" />
              Entity Relationships & Cardinality Table
            </h3>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Parent Entity</th>
                    <th>Cardinality</th>
                    <th>Child Entity</th>
                    <th>Foreign Key Constraint</th>
                    <th>Referential Action</th>
                    <th>Business Semantics</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><code>users</code></td>
                    <td><code>1 : N</code></td>
                    <td><code>user_roles</code></td>
                    <td><code>user_roles.user_id → users.id</code></td>
                    <td><code>ON DELETE CASCADE</code></td>
                    <td>User assigned one or more authorized security roles</td>
                  </tr>
                  <tr>
                    <td><code>roles</code></td>
                    <td><code>1 : N</code></td>
                    <td><code>user_roles</code></td>
                    <td><code>user_roles.role_name → roles.name</code></td>
                    <td><code>ON DELETE RESTRICT</code></td>
                    <td>Defines role capabilities across system users</td>
                  </tr>
                  <tr>
                    <td><code>users</code> (Owner)</td>
                    <td><code>1 : N</code></td>
                    <td><code>datasets</code></td>
                    <td><code>datasets.owner_id → users.id</code></td>
                    <td><code>ON DELETE RESTRICT</code></td>
                    <td>Dataset custodian governing privacy configurations</td>
                  </tr>
                  <tr>
                    <td><code>datasets</code></td>
                    <td><code>1 : N</code></td>
                    <td><code>dataset_columns</code></td>
                    <td><code>dataset_columns.dataset_id → datasets.id</code></td>
                    <td><code>ON DELETE CASCADE</code></td>
                    <td>Approved schema column attributes & bounds</td>
                  </tr>
                  <tr>
                    <td><code>datasets</code></td>
                    <td><code>1 : 1</code></td>
                    <td><code>privacy_policies</code></td>
                    <td><code>privacy_policies.dataset_id → datasets.id</code></td>
                    <td><code>ON DELETE CASCADE</code></td>
                    <td>Differential privacy epsilon/delta policy parameters</td>
                  </tr>
                  <tr>
                    <td><code>datasets</code></td>
                    <td><code>1 : N</code></td>
                    <td><code>dataset_grants</code></td>
                    <td><code>dataset_grants.dataset_id → datasets.id</code></td>
                    <td><code>ON DELETE RESTRICT</code></td>
                    <td>Authorization grants issued to research analysts</td>
                  </tr>
                  <tr>
                    <td><code>dataset_grants</code></td>
                    <td><code>1 : 1</code></td>
                    <td><code>privacy_budgets</code></td>
                    <td><code>privacy_budgets.grant_id → dataset_grants.id</code></td>
                    <td><code>ON DELETE CASCADE</code></td>
                    <td>Real-time remaining epsilon balance (Row-Locked)</td>
                  </tr>
                  <tr>
                    <td><code>privacy_budgets</code></td>
                    <td><code>1 : N</code></td>
                    <td><code>privacy_budget_ledger</code></td>
                    <td><code>ledger.budget_id → privacy_budgets.id</code></td>
                    <td><code>ON DELETE RESTRICT</code></td>
                    <td>Append-only financial debit/credit audit ledger</td>
                  </tr>
                  <tr>
                    <td><code>dataset_grants</code></td>
                    <td><code>1 : N</code></td>
                    <td><code>query_requests</code></td>
                    <td><code>query_requests.grant_id → dataset_grants.id</code></td>
                    <td><code>ON DELETE RESTRICT</code></td>
                    <td>Aggregate query AST requests submitted by analyst</td>
                  </tr>
                  <tr>
                    <td><code>query_requests</code></td>
                    <td><code>1 : 1</code></td>
                    <td><code>query_releases</code></td>
                    <td><code>query_releases.request_id → query_requests.id</code></td>
                    <td><code>ON DELETE RESTRICT</code></td>
                    <td>Released DP noisy outputs with noise scales</td>
                  </tr>
                  <tr>
                    <td><code>users</code></td>
                    <td><code>1 : N</code></td>
                    <td><code>audit_events</code></td>
                    <td><code>audit_events.actor_user_id → users.id</code></td>
                    <td><code>ON DELETE SET NULL</code></td>
                    <td>Comprehensive security audit event log</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Normalization Proof & Mathematical Notation */}
          <div className="glass-panel" style={{ padding: 22 }}>
            <h3 style={{ fontSize: '1rem', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <CheckCircle2 size={16} color="var(--color-success)" />
              Third Normal Form (3NF) Formal Normalization Proof
            </h3>
            <div style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', lineHeight: 1.7, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <p>
                A relational schema is in <strong>Third Normal Form (3NF)</strong> if it is in 2NF and every non-prime attribute is non-transitively dependent on every candidate key of the table (i.e. $X \to Y$ implies $X$ is a superkey or $Y$ is a prime attribute).
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12, marginTop: 4 }}>
                <div style={{ padding: 12, background: 'var(--bg-subtle)', borderRadius: 'var(--radius-sm)' }}>
                  <strong style={{ color: 'var(--text-primary)' }}>1NF Compliance:</strong>
                  <div>All table attributes are atomic. Multi-valued attributes (such as roles) are decoupled into junction relation <code>user_roles</code>. No repeating groups exist.</div>
                </div>
                <div style={{ padding: 12, background: 'var(--bg-subtle)', borderRadius: 'var(--radius-sm)' }}>
                  <strong style={{ color: 'var(--text-primary)' }}>2NF Compliance:</strong>
                  <div>No partial dependencies exist. In composite key tables like <code>user_roles(user_id, role_name)</code>, all attributes depend on the entire primary key.</div>
                </div>
                <div style={{ padding: 12, background: 'var(--bg-subtle)', borderRadius: 'var(--radius-sm)' }}>
                  <strong style={{ color: 'var(--text-primary)' }}>3NF Compliance:</strong>
                  <div>Zero transitive dependencies. In <code>dataset_grants</code>, analyst and granter details are referenced via foreign keys to <code>users</code> rather than storing user attributes redundantly.</div>
                </div>
              </div>
            </div>
          </div>

        </div>
      )}

      {/* VIEW 2: COLUMN CATALOG & SENSITIVITY TAGS */}
      {viewMode === 'catalog' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {selectedDataset && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
              
              {/* Overview Panel */}
              <div className="glass-panel" style={{ padding: 22 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <span className="badge badge-emerald">Active Vault</span>
                  <span className="badge badge-violet">PostgreSQL 17</span>
                </div>
                <h3 style={{ fontSize: '1.15rem', marginBottom: 6 }}>{selectedDataset.name}</h3>
                <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 14 }}>
                  {selectedDataset.description}
                </p>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div><strong>Target Vault Table:</strong> <code>{selectedDataset.target_table}</code> (Restricted RLS)</div>
                  <div><strong>Data Custodian:</strong> {selectedDataset.owner_name}</div>
                </div>
              </div>

              {/* Privacy Policy Panel */}
              {selectedDataset.active_policy && (
                <div className="glass-panel" style={{ padding: 22, borderLeft: '4px solid var(--accent-primary)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <h4 style={{ fontSize: '0.95rem', color: 'var(--accent-primary)' }}>Governing Differential Privacy Policy</h4>
                    <span className="badge badge-cyan">{selectedDataset.active_policy.approved_mechanisms}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, fontSize: '0.8rem', marginTop: 12 }}>
                    <div>
                      <div style={{ color: 'var(--text-muted)' }}>Max Epsilon / Query</div>
                      <div style={{ fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{selectedDataset.active_policy.max_epsilon_per_query} ε</div>
                    </div>
                    <div>
                      <div style={{ color: 'var(--text-muted)' }}>Global Epsilon Cap</div>
                      <div style={{ fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{selectedDataset.active_policy.global_epsilon_cap} ε</div>
                    </div>
                    <div>
                      <div style={{ color: 'var(--text-muted)' }}>Sensitivity Clamping Interval</div>
                      <div style={{ fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                        [{selectedDataset.active_policy.sensitivity_clamp_low}, {selectedDataset.active_policy.sensitivity_clamp_high}]
                      </div>
                    </div>
                    <div>
                      <div style={{ color: 'var(--text-muted)' }}>Default Delta (δ)</div>
                      <div style={{ fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{selectedDataset.active_policy.default_delta}</div>
                    </div>
                  </div>
                </div>
              )}

            </div>
          )}

          {/* Column Schema Table */}
          {selectedDataset && (
            <div className="glass-panel" style={{ padding: 22 }}>
              <h3 style={{ fontSize: '1rem', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Layers size={16} color="var(--accent-primary)" />
                Column Dictionary & Sensitivity Tags
              </h3>

              <div style={{ overflowX: 'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Column Name</th>
                      <th>Data Type</th>
                      <th>Sensitivity Classification</th>
                      <th>Aggregatable?</th>
                      <th>Physical Domain Bounds</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedDataset.columns.map((col) => (
                      <tr key={col.id}>
                        <td style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                          {col.column_name}
                        </td>
                        <td style={{ color: 'var(--text-secondary)' }}>
                          {col.data_type}
                        </td>
                        <td>
                          {col.is_identifier ? (
                            <span className="badge badge-rose" style={{ fontSize: '0.65rem' }}>Direct Identifier</span>
                          ) : col.is_sensitive ? (
                            <span className="badge badge-amber" style={{ fontSize: '0.65rem' }}>Protected Health Attribute</span>
                          ) : (
                            <span className="badge badge-emerald" style={{ fontSize: '0.65rem' }}>Public Demographic</span>
                          )}
                        </td>
                        <td>
                          {col.is_aggregatable ? (
                            <span style={{ color: 'var(--color-success)', fontWeight: 600 }}>Yes (Clamped)</span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)' }}>No (Filter Only)</span>
                          )}
                        </td>
                        <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                          {col.min_bound !== null && col.max_bound !== null ? `[${col.min_bound}, ${col.max_bound}]` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  );
};
