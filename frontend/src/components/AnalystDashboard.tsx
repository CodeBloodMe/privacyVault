import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, 
  CheckCircle, 
  AlertTriangle, 
  Play, 
  Search, 
  Plus, 
  Trash2, 
  Activity, 
  Zap, 
  Clock, 
  Sliders, 
  ShieldCheck, 
  RefreshCw,
  X,
  Sparkles,
  Database
} from 'lucide-react';
import { api } from '../services/api';
import { 
  DatasetGrant, 
  Dataset, 
  MetricType, 
  FilterCriterion, 
  QueryValidationResponse, 
  QueryRelease, 
  QueryRequestHistory, 
  BudgetSummary,
  LedgerEntry
} from '../types/api';
import { LaplaceVisualizer } from './LaplaceVisualizer';

interface ClinicalPreset {
  name: string;
  badge: string;
  desc: string;
  metric: MetricType;
  targetCol: string;
  filters: FilterCriterion[];
  epsilon: number;
}

const CLINICAL_PRESETS: ClinicalPreset[] = [
  {
    name: '🚑 Emergency Inpatient Volume',
    badge: 'COUNT',
    desc: 'Emergency admissions triage volume',
    metric: 'COUNT',
    targetCol: '',
    filters: [{ column: 'admission_type', operator: 'EQ', value: 'EMERGENCY' }],
    epsilon: 0.50
  },
  {
    name: '🫀 Hypertension Costs (I10)',
    badge: 'BOUNDED_SUM',
    desc: 'Aggregate spend on Essential Hypertension',
    metric: 'BOUNDED_SUM',
    targetCol: 'treatment_cost',
    filters: [{ column: 'diagnosis_code', operator: 'EQ', value: 'I10' }],
    epsilon: 0.50
  },
  {
    name: '🎗️ Oncology Cost Mean (C34)',
    badge: 'BOUNDED_AVG',
    desc: 'OpenDP composite mean for Bronchus & Lung Carcinoma',
    metric: 'BOUNDED_AVG',
    targetCol: 'treatment_cost',
    filters: [{ column: 'diagnosis_code', operator: 'EQ', value: 'C34' }],
    epsilon: 0.50
  },
  {
    name: '🧪 Targeted Cohort Reconstruction',
    badge: 'DIFFERENCING',
    desc: 'Simulate differencing attack with Machine Dependent cohort (Z99)',
    metric: 'COUNT',
    targetCol: '',
    filters: [{ column: 'diagnosis_code', operator: 'EQ', value: 'Z99' }],
    epsilon: 0.50
  }
];

const ICD10_DIAGNOSES = [
  { code: 'I10', label: 'I10 — Essential (Primary) Hypertension' },
  { code: 'E11', label: 'E11 — Type 2 Diabetes Mellitus' },
  { code: 'C34', label: 'C34 — Malignant Neoplasm of Bronchus & Lung' },
  { code: 'I21', label: 'I21 — Acute Myocardial Infarction' },
  { code: 'J44', label: 'J44 — Chronic Obstructive Pulmonary Disease' },
  { code: 'M17', label: 'M17 — Osteoarthritis of Knee' },
  { code: 'K21', label: 'K21 — Gastro-Esophageal Reflux Disease' },
  { code: 'Z99', label: 'Z99 — Dependence on Enabling Machines (Target Cohort)' }
];

const ADMISSION_TYPES = [
  { value: 'EMERGENCY', label: 'EMERGENCY — Inpatient Emergency' },
  { value: 'ELECTIVE', label: 'ELECTIVE — Planned Surgical/Medical' },
  { value: 'URGENT', label: 'URGENT — Urgent Unscheduled Care' }
];

const GENDER_OPTIONS = [
  { value: 'M', label: 'M — Male' },
  { value: 'F', label: 'F — Female' },
  { value: 'OTHER', label: 'OTHER — Other / Non-binary' }
];

const BLOOD_GROUPS = [
  'O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'
];

export const AnalystDashboard: React.FC = () => {
  const [grants, setGrants] = useState<DatasetGrant[]>([]);
  const [selectedGrant, setSelectedGrant] = useState<DatasetGrant | null>(null);
  const [datasetDetails, setDatasetDetails] = useState<Dataset | null>(null);
  const [budgetSummary, setBudgetSummary] = useState<BudgetSummary | null>(null);
  const [budgetLedger, setBudgetLedger] = useState<{ budgetId: string; entries: LedgerEntry[] } | null>(null);
  const [budgetLedgerError, setBudgetLedgerError] = useState<{ budgetId: string; message: string } | null>(null);
  
  // Query Builder State
  const [metric, setMetric] = useState<MetricType>('COUNT');
  const [targetColumn, setTargetColumn] = useState<string>('');
  const [filters, setFilters] = useState<FilterCriterion[]>([]);
  const [requestedEpsilon, setRequestedEpsilon] = useState<number>(0.5);
  
  // Execution & Validation State
  const [isValidating, setIsValidating] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [validationResult, setValidationResult] = useState<QueryValidationResponse | null>(null);
  const [latestRelease, setLatestRelease] = useState<QueryRelease | null>(null);
  const [executionError, setExecutionError] = useState<string | null>(null);
  const [unauthorizedMessage, setUnauthorizedMessage] = useState<string | null>(null);
  
  // History
  const [history, setHistory] = useState<QueryRequestHistory[]>([]);

  // Load grants and budget summaries
  const refreshData = async () => {
    try {
      const myGrants = await api.getMyGrants();
      setGrants(myGrants);
      if (myGrants.length > 0) {
        if (!selectedGrant || !myGrants.some(g => g.id === selectedGrant.id)) {
          setSelectedGrant(myGrants[0]);
        }
      } else {
        setSelectedGrant(null);
      }

      const budgets = await api.getMyBudgetSummary();
      if (budgets.length > 0) {
        const preferredGrantId = selectedGrant?.id ?? myGrants[0]?.id;
        const activeBudget = budgets.find(b => b.grant_id === preferredGrantId)
          || budgets.find(b => b.grant_active)
          || budgets[0];
        setBudgetSummary(activeBudget);
      } else {
        setBudgetSummary(null);
      }

      const hist = await api.getMyQueryHistory();
      setHistory(hist);
    } catch (err: any) {
      if (err.status === 403) {
        setUnauthorizedMessage(err.message || 'Operation requires the ANALYST role.');
      } else {
        console.error('Failed to load analyst telemetry:', err);
      }
    }
  };

  useEffect(() => {
    refreshData();
  }, []);

  // Active grant resolution with safe fallback
  const activeGrant = selectedGrant && grants.some(g => g.id === selectedGrant.id)
    ? selectedGrant
    : (grants.length > 0 ? grants[0] : null);

  // Fetch dataset schema when active grant changes
  useEffect(() => {
    setExecutionError(null);
    setValidationResult(null);
    setLatestRelease(null);
    if (activeGrant) {
      if (!selectedGrant || selectedGrant.id !== activeGrant.id) {
        setSelectedGrant(activeGrant);
      }
      api.getDataset(activeGrant.dataset_id).then((ds) => {
        setDatasetDetails(ds);
        const aggCol = ds.columns.find((c) => c.is_aggregatable);
        if (aggCol) setTargetColumn(aggCol.column_name);
      }).catch(console.error);

      api.getMyBudgetSummary().then((budgets) => {
        const matching = budgets.find(b => b.grant_id === activeGrant.id);
        if (matching) setBudgetSummary(matching);
      }).catch(console.error);
    } else {
      setDatasetDetails(null);
      setBudgetSummary(null);
    }
  }, [activeGrant?.id]);

  useEffect(() => {
    let cancelled = false;
    const budgetId = activeGrant?.id && budgetSummary?.grant_id === activeGrant.id
      ? budgetSummary?.budget_id
      : null;

    if (!budgetId) return;

    api.getBudgetLedger(budgetId)
      .then((entries) => {
        if (!cancelled) setBudgetLedger({ budgetId, entries });
      })
      .catch((err: Error) => {
        if (cancelled) return;
        console.error('Failed to load privacy budget ledger:', err);
        setBudgetLedgerError({ budgetId, message: err.message || 'Unable to load ledger entries.' });
      });

    return () => {
      cancelled = true;
    };
  }, [budgetSummary?.budget_id, budgetSummary?.grant_id, activeGrant?.id]);

  // Filter manipulation
  const handleAddFilter = () => {
    setExecutionError(null);
    setValidationResult(null);
    setLatestRelease(null);
    if (!datasetDetails || datasetDetails.columns.length === 0) return;
    const defaultCol = datasetDetails.columns.find((c) => !c.is_identifier) || datasetDetails.columns[0];
    setFilters((current) => [...current, { column: defaultCol.column_name, operator: 'EQ', value: '' }]);
  };

  const handleUpdateFilter = (index: number, field: keyof FilterCriterion, val: any) => {
    setExecutionError(null);
    setValidationResult(null);
    setLatestRelease(null);
    setFilters((current) => current.map((filter, i) => (
      i === index ? { ...filter, [field]: val } : filter
    )));
  };

  const handleChangeFilterColumn = (index: number, column: string) => {
    setExecutionError(null);
    setValidationResult(null);
    setLatestRelease(null);
    setFilters((current) => current.map((filter, i) => (
      i === index ? { ...filter, column, value: '' } : filter
    )));
  };

  const handleRemoveFilter = (index: number) => {
    setExecutionError(null);
    setValidationResult(null);
    setLatestRelease(null);
    setFilters((current) => current.filter((_, i) => i !== index));
  };

  // Run dry-run risk analysis
  const handleValidate = async () => {
    if (!activeGrant || isValidating || isSubmitting) return;
    setIsValidating(true);
    setExecutionError(null);
    setLatestRelease(null);
    try {
      const res = await api.validateQuery({
        grant_id: activeGrant.id,
        metric,
        target_column: metric !== 'COUNT' ? targetColumn : undefined,
        filters,
        requested_epsilon: requestedEpsilon,
        requested_delta: 0.0
      });
      setValidationResult(res);
    } catch (err: any) {
      setExecutionError(err.message || 'Validation request failed');
    } finally {
      setIsValidating(false);
    }
  };

  // Submit approved aggregate query with idempotency request_id
  const handleSubmit = async () => {
    if (!activeGrant || isSubmitting) return;
    setIsSubmitting(true);
    setExecutionError(null);
    setLatestRelease(null);
    try {
      const clientRequestId = crypto.randomUUID();
      const release = await api.submitQuery({
        request_id: clientRequestId,
        grant_id: activeGrant.id,
        metric,
        target_column: metric !== 'COUNT' ? targetColumn : undefined,
        filters,
        requested_epsilon: requestedEpsilon,
        requested_delta: 0.0
      });
      setLatestRelease(release);
      setValidationResult(null);
      await refreshData();
    } catch (err: any) {
      setExecutionError(err.message || 'Differential privacy query failed');
      if (err.payload?.differencing_detected) {
        setValidationResult({
          valid: false,
          error: err.payload.error,
          risk_level: err.payload.risk_level || 'CRITICAL',
          risk_summary: err.payload.error,
          differencing_detected: true,
          estimated_epsilon: requestedEpsilon
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApplyPreset = (preset: typeof CLINICAL_PRESETS[0]) => {
    setMetric(preset.metric);
    if (preset.targetCol) {
      setTargetColumn(preset.targetCol);
    }
    setFilters([...preset.filters]);
    setRequestedEpsilon(preset.epsilon);
    setExecutionError(null);
    setValidationResult(null);
    setLatestRelease(null);
  };

  const aggregatableCols = datasetDetails?.columns.filter((c) => c.is_aggregatable) || [];
  const filterableCols = datasetDetails?.columns.filter((c) => !c.is_identifier) || [];
  const activeBudgetSummary = budgetSummary && budgetSummary.grant_id === activeGrant?.id
    ? budgetSummary
    : null;
  const activeBudgetLedger = activeBudgetSummary && budgetLedger?.budgetId === activeBudgetSummary.budget_id
    ? budgetLedger.entries
    : null;
  const activeBudgetLedgerError = activeBudgetSummary && budgetLedgerError?.budgetId === activeBudgetSummary.budget_id
    ? budgetLedgerError.message
    : null;
  const pendingRequestIds = new Set(
    history
      .filter((request) => request.status === 'RESERVED' || request.status === 'EXECUTING')
      .map((request) => request.id)
  );
  const inFlightReservedEpsilon = activeBudgetLedger?.filter((entry) => (
    entry.transaction_type === 'RESERVATION'
    && entry.request_id !== null
    && entry.request_id !== undefined
    && pendingRequestIds.has(entry.request_id)
  )).reduce((total, entry) => total + Number(entry.amount), 0);
  const refundedEpsilon = activeBudgetLedger?.filter((entry) => entry.transaction_type === 'REFUND')
    .reduce((total, entry) => total + Number(entry.amount), 0);

  if (unauthorizedMessage) {
    return (
      <div style={{ maxWidth: 700, margin: '60px auto', padding: '0 20px', textAlign: 'center' }}>
        <div className="glass-panel" style={{ padding: 36, borderColor: 'var(--border-danger)' }}>
          <div style={{ width: 48, height: 48, borderRadius: 'var(--radius-md)', background: 'var(--bg-danger)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
            <ShieldAlert size={24} color="var(--color-danger)" />
          </div>
          <h3 style={{ fontSize: '1.2rem', marginBottom: 8, color: 'var(--color-danger)' }}>Access Restricted: Role Authorization Enforced</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6, maxWidth: 520, margin: '0 auto 16px auto' }}>
            {unauthorizedMessage}
          </p>
          <span className="badge badge-rose">HTTP 403 Forbidden (FastAPI RBAC)</span>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: 24 }}>
      
      {/* Clinical Inpatient Telemetry Bar */}
      <div 
        style={{ 
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', 
          borderRadius: 'var(--radius-lg)', 
          padding: '16px 20px', 
          color: '#ffffff',
          boxShadow: 'var(--shadow-md)',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: 'var(--radius-md)', background: 'linear-gradient(135deg, #2563eb 0%, #06b6d4 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(37, 99, 235, 0.4)' }}>
            <Database size={22} color="#ffffff" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: '1.05rem', fontWeight: 800, letterSpacing: '-0.01em' }}>
                Protected Clinical Inpatient Cohort (10,000 Records)
              </span>
              <span className="badge badge-emerald" style={{ fontSize: '0.65rem' }}>HIPAA De-identified</span>
              <span className="badge badge-cyan" style={{ fontSize: '0.65rem' }}>OpenDP 0.16.0</span>
            </div>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: 2 }}>
              Multi-specialty inpatient cohort, demographic attributes, and bounded billing statistics
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
          <div style={{ borderLeft: '1px solid rgba(255, 255, 255, 0.15)', paddingLeft: 16 }}>
            <div style={{ fontSize: '0.68rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Sensitivity Clamp</div>
            <div style={{ fontSize: '0.85rem', fontWeight: 700, fontFamily: 'var(--font-mono)', color: '#38bdf8' }}>[$500.00, $50,000.00]</div>
          </div>
          <div style={{ borderLeft: '1px solid rgba(255, 255, 255, 0.15)', paddingLeft: 16 }}>
            <div style={{ fontSize: '0.68rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>ACID Concurrency</div>
            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#4ade80' }}>SELECT FOR UPDATE</div>
          </div>
          <div style={{ borderLeft: '1px solid rgba(255, 255, 255, 0.15)', paddingLeft: 16 }}>
            <div style={{ fontSize: '0.68rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Audit Integrity</div>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, fontFamily: 'var(--font-mono)', color: '#fbbf24' }}>SHA-256 HMAC</div>
          </div>
        </div>
      </div>

      {/* Top Bar: Grant Selector & Budget Gauge */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
        
        {/* Active Grant Info */}
        <div className="glass-panel" style={{ padding: 20, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Active Dataset Grant
              </span>
              <span className={`badge ${grants.length > 0 ? 'badge-emerald' : 'badge-rose'}`}>
                {grants.length > 0 ? 'Authorized' : 'No Active Grant'}
              </span>
            </div>
            
            {grants.length > 0 ? (
              <select 
                className="form-select"
                value={activeGrant?.id || ''}
                onChange={(e) => {
                  const g = grants.find(item => item.id === e.target.value);
                  if (g) setSelectedGrant(g);
                }}
                style={{ fontWeight: 600, fontSize: '0.9rem' }}
              >
                {grants.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.dataset_name} ({g.remaining_epsilon} ε remaining)
                  </option>
                ))}
              </select>
            ) : (
              <div style={{ padding: '10px 14px', background: 'rgba(239, 68, 68, 0.08)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-danger)', color: 'var(--color-danger)', fontSize: '0.85rem' }}>
                No active dataset grant found for this account (Grant may be revoked or expired). Switch to Data Owner to issue or re-activate a grant.
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 14, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              <div><Clock size={13} style={{ verticalAlign: -2 }} /> Expires: {activeGrant ? new Date(activeGrant.expires_at).toLocaleDateString() : 'N/A'}</div>
              <div><ShieldCheck size={13} style={{ verticalAlign: -2 }} /> Engine: OpenDP 0.16.0</div>
            </div>
          </div>
        </div>

        {/* Backend Budget Summary and Ledger Totals */}
        <div className="glass-panel" style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Privacy Budget (ε)
            </span>
            <span className="badge badge-cyan text-mono">
              {activeBudgetSummary
                ? `${Number(activeBudgetSummary.remaining_epsilon).toFixed(4)} ε remaining`
                : 'Loading budget...'}
            </span>
          </div>

          <dl className="budget-metrics-grid">
            <div><dt>Allocated</dt><dd>{activeBudgetSummary ? `${Number(activeBudgetSummary.total_epsilon).toFixed(4)} ε` : '—'}</dd></div>
            <div><dt>Spent / charged</dt><dd>{activeBudgetSummary ? `${Number(activeBudgetSummary.spent_epsilon).toFixed(4)} ε` : '—'}</dd></div>
            <div title="Only reservations linked to requests currently marked RESERVED or EXECUTING are included.">
              <dt>Reserved · in flight</dt>
              <dd>
                {activeBudgetLedgerError
                  ? 'Unavailable'
                  : inFlightReservedEpsilon === undefined
                    ? activeBudgetSummary ? 'Loading...' : '—'
                    : `${inFlightReservedEpsilon.toFixed(4)} ε`}
              </dd>
            </div>
            <div><dt>Refunded · ledger</dt><dd>
              {activeBudgetLedgerError
                ? 'Unavailable'
                : refundedEpsilon === undefined
                  ? activeBudgetSummary ? 'Loading...' : '—'
                  : `${refundedEpsilon.toFixed(4)} ε`}
            </dd></div>
            <div><dt>Remaining · backend</dt><dd>{activeBudgetSummary ? `${Number(activeBudgetSummary.remaining_epsilon).toFixed(4)} ε` : '—'}</dd></div>
          </dl>
          <p className="budget-ledger-note">
            Allocated, spent, and remaining are from the backend budget summary. Reservation and refund figures come from ledger entries; the remaining balance is not recalculated here.
          </p>
          {activeBudgetLedgerError && (
            <p className="budget-ledger-error" role="status">Ledger details could not be loaded: {activeBudgetLedgerError}</p>
          )}
        </div>

      </div>

      {/* Main Grid: Query Builder & Results Panel */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 460px), 1fr))', gap: 24 }}>
        
        {/* Left: Interactive Query Builder */}
        <div className="glass-panel" style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 18 }}>
          
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ fontSize: '1rem', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Sliders size={16} color="var(--accent-primary)" />
              Structured Aggregate Builder
            </h3>
            <span className="badge badge-violet" style={{ fontSize: '0.65rem' }}>No Direct SQL</span>
          </div>

          {/* Quick Clinical Query Presets */}
          <div style={{ padding: '12px 14px', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: 5 }}>
                <Sparkles size={13} color="var(--accent-primary)" />
                1-Click Clinical Research Presets
              </span>
              <span className="badge badge-cyan" style={{ fontSize: '0.6rem' }}>Instant Config</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 8 }}>
              {CLINICAL_PRESETS.map((p, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleApplyPreset(p)}
                  className="btn btn-secondary"
                  style={{ 
                    padding: '8px 10px', 
                    fontSize: '0.75rem', 
                    display: 'flex', 
                    flexDirection: 'column', 
                    alignItems: 'flex-start',
                    textAlign: 'left',
                    gap: 3,
                    borderColor: 'var(--border-strong)',
                    background: '#ffffff',
                    cursor: 'pointer'
                  }}
                  title={p.desc}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                    <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.74rem' }}>{p.name}</span>
                    <span className="badge badge-violet" style={{ fontSize: '0.58rem', padding: '1px 5px' }}>{p.badge}</span>
                  </div>
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', lineHeight: 1.2 }}>{p.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Metric Selection */}
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
              1. Approved Aggregate Metric
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {(['COUNT', 'BOUNDED_SUM', 'BOUNDED_AVG'] as MetricType[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setMetric(m);
                    setExecutionError(null);
                    setValidationResult(null);
                    setLatestRelease(null);
                  }}
                  className={`btn ${metric === m ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ padding: '7px 8px', fontSize: '0.78rem' }}
                >
                  {m}
                </button>
              ))}
            </div>
            {metric === 'BOUNDED_AVG' && (
              <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.4 }}>
                <strong>Composite DP Mean:</strong> Uses OpenDP 0.16.0 compositional DP ($\epsilon/2$ Bounded Sum + $\epsilon/2$ Count). Both components receive independent Laplace noise; raw counts are never disclosed.
              </p>
            )}
          </div>

          {/* Target Column (if not COUNT) */}
          {metric !== 'COUNT' && (
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                2. Target Numerical Column (Contribution Clamped to [500, 50000])
              </label>
              <select
                className="form-select"
                value={targetColumn}
                onChange={(e) => {
                  setTargetColumn(e.target.value);
                  setLatestRelease(null);
                }}
              >
                {aggregatableCols.map((c) => (
                  <option key={c.column_name} value={c.column_name}>
                    {c.column_name} ({c.data_type})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Dynamic Filter Criteria */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                3. Filter Predicates (Cohort Selection)
              </label>
              <button
                type="button"
                onClick={handleAddFilter}
                className="btn btn-secondary"
                style={{ padding: '4px 10px', fontSize: '0.72rem' }}
              >
                <Plus size={13} /> Add Filter
              </button>
            </div>

            {filters.length === 0 ? (
              <div style={{ padding: '12px', background: 'var(--bg-subtle)', border: '1px dashed var(--border-strong)', borderRadius: 'var(--radius-md)', textAlign: 'center', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                No filters applied. Aggregate will evaluate across the entire protected patient population (10,000 records).
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {filters.map((f, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <select
                      className="form-select"
                      style={{ flex: 1.8 }}
                      value={f.column}
                      onChange={(e) => handleChangeFilterColumn(idx, e.target.value)}
                    >
                      {filterableCols.map((c) => (
                        <option key={c.column_name} value={c.column_name}>{c.column_name}</option>
                      ))}
                    </select>

                    <select
                      className="form-select"
                      style={{ flex: 1.1 }}
                      value={f.operator}
                      onChange={(e) => handleUpdateFilter(idx, 'operator', e.target.value)}
                    >
                      <option value="EQ">=</option>
                      <option value="NEQ">≠</option>
                      <option value="GT">&gt;</option>
                      <option value="GTE">≥</option>
                      <option value="LT">&lt;</option>
                      <option value="LTE">≤</option>
                    </select>

                    {/* Intelligent filter value selector based on selected column */}
                    {f.column === 'diagnosis_code' ? (
                      <select
                        className="form-select"
                        style={{ flex: 2.3 }}
                        value={f.value}
                        onChange={(e) => handleUpdateFilter(idx, 'value', e.target.value)}
                      >
                        <option value="">Select ICD-10 Code...</option>
                        {ICD10_DIAGNOSES.map((d) => (
                          <option key={d.code} value={d.code}>{d.label}</option>
                        ))}
                      </select>
                    ) : f.column === 'admission_type' ? (
                      <select
                        className="form-select"
                        style={{ flex: 2.3 }}
                        value={f.value}
                        onChange={(e) => handleUpdateFilter(idx, 'value', e.target.value)}
                      >
                        <option value="">Select Admission Type...</option>
                        {ADMISSION_TYPES.map((a) => (
                          <option key={a.value} value={a.value}>{a.label}</option>
                        ))}
                      </select>
                    ) : f.column === 'gender' ? (
                      <select
                        className="form-select"
                        style={{ flex: 2.3 }}
                        value={f.value}
                        onChange={(e) => handleUpdateFilter(idx, 'value', e.target.value)}
                      >
                        <option value="">Select Gender...</option>
                        {GENDER_OPTIONS.map((g) => (
                          <option key={g.value} value={g.value}>{g.label}</option>
                        ))}
                      </select>
                    ) : f.column === 'blood_group' ? (
                      <select
                        className="form-select"
                        style={{ flex: 2.3 }}
                        value={f.value}
                        onChange={(e) => handleUpdateFilter(idx, 'value', e.target.value)}
                      >
                        <option value="">Select Blood Group...</option>
                        {BLOOD_GROUPS.map((bg) => (
                          <option key={bg} value={bg}>{bg}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        className="form-input"
                        style={{ flex: 2.3 }}
                        placeholder="Comparison value"
                        value={f.value}
                        onChange={(e) => handleUpdateFilter(idx, 'value', e.target.value)}
                      />
                    )}

                    <button
                      type="button"
                      onClick={() => handleRemoveFilter(idx)}
                      style={{ background: 'transparent', border: 'none', color: 'var(--color-danger)', cursor: 'pointer', padding: 4 }}
                      title="Remove filter"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Privacy Budget Allocation Slider */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 600, marginBottom: 6 }}>
              <span style={{ color: 'var(--text-secondary)' }}>4. Requested Privacy Budget Expenditure (ε)</span>
              <span style={{ color: 'var(--accent-primary)', fontFamily: 'var(--font-mono)' }}>{requestedEpsilon.toFixed(2)} ε</span>
            </div>
            <input
              type="range"
              min="0.1"
              max="1.0"
              step="0.05"
              value={requestedEpsilon}
              onChange={(e) => {
                setRequestedEpsilon(parseFloat(e.target.value));
                setLatestRelease(null);
              }}
              style={{ width: '100%', accentColor: 'var(--accent-primary)' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 4 }}>
              <span>0.10 ε (Higher Privacy / More Noise)</span>
              <span>1.00 ε (Higher Accuracy / Less Noise)</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <button
              type="button"
              onClick={handleValidate}
              disabled={isValidating || isSubmitting}
              className="btn btn-secondary"
              style={{ flex: 1 }}
            >
              <Search size={14} />
              {isValidating ? 'Analyzing History...' : 'Evaluate Risk (Dry Run)'}
            </button>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={isValidating || isSubmitting}
              className="btn btn-primary"
              style={{ flex: 1 }}
            >
              <Play size={14} />
              {isSubmitting ? 'Perturbing with OpenDP...' : 'Execute & Release DP'}
            </button>
          </div>

          {/* Error Banner */}
          {executionError && (
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, padding: '10px 14px', background: 'var(--bg-danger)', border: '1px solid var(--border-danger)', borderRadius: 'var(--radius-md)', color: 'var(--color-danger)', fontSize: '0.825rem' }}>
              <div>
                <strong>Execution Halted:</strong> {executionError}
              </div>
              <button 
                type="button" 
                onClick={() => setExecutionError(null)}
                style={{ background: 'transparent', border: 'none', color: 'var(--color-danger)', cursor: 'pointer', padding: 0 }}
                title="Dismiss"
              >
                <X size={15} />
              </button>
            </div>
          )}

        </div>

        {/* Right: Risk Analysis & Live DP Results */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          
          {/* Query-History Risk Analysis Card */}
          {validationResult && (
            <div 
              className="glass-panel"
              style={{ 
                padding: 20, 
                borderColor: validationResult.risk_level === 'CRITICAL' ? 'var(--border-danger)' : validationResult.risk_level === 'HIGH' ? 'var(--border-warning)' : 'var(--border-success)',
                background: validationResult.risk_level === 'CRITICAL' ? 'var(--bg-danger)' : validationResult.risk_level === 'HIGH' ? 'var(--bg-warning)' : 'var(--bg-success)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {validationResult.risk_level === 'CRITICAL' ? (
                    <ShieldAlert size={20} color="var(--color-danger)" />
                  ) : validationResult.risk_level === 'HIGH' ? (
                    <AlertTriangle size={20} color="var(--color-warning)" />
                  ) : (
                    <CheckCircle size={20} color="var(--color-success)" />
                  )}
                  <h4 style={{ fontSize: '0.95rem' }}>Query-History Risk Analysis</h4>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className={`badge ${validationResult.risk_level === 'CRITICAL' ? 'badge-rose' : validationResult.risk_level === 'HIGH' ? 'badge-amber' : 'badge-emerald'}`}>
                    {validationResult.risk_level} RISK
                  </span>
                  <button
                    type="button"
                    onClick={() => setValidationResult(null)}
                    style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 2 }}
                    title="Dismiss"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>

              <div style={{ fontSize: '0.825rem', lineHeight: 1.5, color: 'var(--text-primary)', marginBottom: 10 }}>
                {validationResult.risk_summary}
              </div>

              {validationResult.differencing_detected && (
                <div style={{ padding: '8px 12px', background: 'rgba(255, 255, 255, 0.7)', border: '1px solid var(--border-danger)', borderRadius: 'var(--radius-sm)', fontSize: '0.78rem', color: 'var(--color-danger)' }}>
                  <strong>Differencing Protection Activated:</strong> Query overlap with prior requests could allow targeted individual reconstruction. Execution refused prior to data access.
                </div>
              )}
            </div>
          )}

          {/* Differential Privacy Release Card */}
          {latestRelease ? (
            <div className="glass-panel" style={{ padding: 22, borderTop: '4px solid var(--accent-primary)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-primary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Released Differential Privacy Statistic
                </span>
                <span className="badge badge-cyan">{latestRelease.mechanism_used}</span>
              </div>

              <LaplaceVisualizer
                noisyResult={latestRelease.noisy_result}
                noiseScale={latestRelease.noise_scale}
                epsilonSpent={latestRelease.epsilon_spent}
                sensitivity={latestRelease.sensitivity_applied}
                mechanism={latestRelease.mechanism_used}
                metric={latestRelease.metric}
              />

              {/* Signature Footer */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                <span>Signature: <code style={{ fontFamily: 'var(--font-mono)' }}>{latestRelease.author_signature}</code></span>
                <span>Released: {new Date(latestRelease.released_at).toLocaleTimeString()}</span>
              </div>
            </div>
          ) : (
            <div className="glass-panel" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <Zap size={32} color="var(--accent-primary)" style={{ marginBottom: 12, opacity: 0.7 }} />
              <div style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-secondary)' }}>Awaiting Query Submission</div>
              <p style={{ fontSize: '0.8rem', maxWidth: 360, marginTop: 4 }}>
                Configure aggregate parameters on the left and select "Execute & Release DP" to view mathematically perturbed results.
              </p>
            </div>
          )}

        </div>

      </div>

      {/* Query Release History Table */}
      <div className="glass-panel" style={{ padding: 22 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <h3 style={{ fontSize: '1rem', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Activity size={16} color="var(--accent-primary)" />
            Query Execution History
          </h3>
          <button onClick={refreshData} className="btn btn-secondary" style={{ padding: '5px 12px', fontSize: '0.75rem' }}>
            <RefreshCw size={12} /> Refresh
          </button>
        </div>

        <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 12 }}>
          Dry-run validation does not create a released result or spend privacy budget. This history shows requests recorded by the backend and marks unreleased requests separately.
        </p>

        {history.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: '0.825rem' }}>
            No queries recorded yet under this account.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Metric</th>
                  <th>Submitted Filters</th>
                  <th>Epsilon Spent</th>
                  <th>Released DP Result</th>
                  <th>Risk</th>
                  <th>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.id}>
                    <td>
                      <span className={`badge ${h.status === 'RELEASED' ? 'badge-emerald' : h.status === 'REJECTED' || h.status === 'FAILED' ? 'badge-rose' : 'badge-amber'}`}>
                        {h.status === 'RELEASED'
                          ? 'Released'
                          : h.status === 'VALIDATED'
                            ? 'Validated · not released'
                            : h.status}
                      </span>
                    </td>
                    <td style={{ fontWeight: 600 }}>{h.metric}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>
                      {h.target_column ? <div>Target: {h.target_column}</div> : null}
                      {h.filter_criteria?.length > 0
                        ? h.filter_criteria.map(f => `${f.column} ${f.operator} ${f.value}`).join(', ')
                        : 'None'}
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--accent-primary)' }}>
                      {h.release ? `${Number(h.release.epsilon_spent).toFixed(4)} ε` : '—'}
                    </td>
                    <td>
                      {h.release ? (
                        <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                          {Number(h.release.noisy_result).toFixed(2)}
                          {h.metric === 'COUNT' && Number(h.release.noisy_result) < 0 && (
                            <span className="history-negative-count-warning">
                              <AlertTriangle size={13} aria-hidden="true" />
                              Negative noisy COUNT; released value shown unchanged.
                            </span>
                          )}
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }} title="No differentially private result was released for this request.">
                          No result released
                        </span>
                      )}
                    </td>
                    <td>
                      <span className={`badge ${h.risk_level === 'CRITICAL' ? 'badge-rose' : h.risk_level === 'HIGH' ? 'badge-amber' : 'badge-cyan'}`} style={{ fontSize: '0.65rem' }}>
                        {h.risk_level}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-muted)' }}>
                      {new Date(h.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
};
