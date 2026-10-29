import {
  AuthTokenResponse,
  UserProfile,
  Dataset,
  DatasetGrant,
  AggregateQueryRequest,
  QueryValidationResponse,
  QueryRelease,
  QueryRequestHistory,
  BudgetSummary,
  LedgerEntry,
  AuditEvent,
  SystemHealth
} from '../types/api';

// Pre-seeded User Profiles
const MOCK_USERS: Record<string, UserProfile> = {
  'krish.24bce0846@vitstudent.ac.in': {
    id: 'usr-krish-01',
    email: 'krish.24bce0846@vitstudent.ac.in',
    full_name: 'Krish (Lead Epidemiologist)',
    is_active: true,
    roles: ['ANALYST', 'ADMIN'],
    created_at: '2026-01-15T09:00:00Z'
  },
  'parv.24bce0870@vitstudent.ac.in': {
    id: 'usr-parv-02',
    email: 'parv.24bce0870@vitstudent.ac.in',
    full_name: 'Parv (Biostatistician)',
    is_active: true,
    roles: ['ANALYST'],
    created_at: '2026-01-15T09:00:00Z'
  },
  'dataowner@privacyvault.local': {
    id: 'usr-owner-03',
    email: 'dataowner@privacyvault.local',
    full_name: 'Dr. V. Sivakumar (Data Custodian)',
    is_active: true,
    roles: ['DATA_OWNER', 'ADMIN'],
    created_at: '2026-01-01T08:00:00Z'
  },
  'dr.sivakumar@vit.ac.in': {
    id: 'usr-owner-03',
    email: 'dr.sivakumar@vit.ac.in',
    full_name: 'Dr. V. Sivakumar (Chief Data Officer)',
    is_active: true,
    roles: ['DATA_OWNER', 'ADMIN'],
    created_at: '2026-01-01T08:00:00Z'
  },
  'auditor@privacyvault.local': {
    id: 'usr-auditor-04',
    email: 'auditor@privacyvault.local',
    full_name: 'Compliance Officer (Lead Auditor)',
    is_active: true,
    roles: ['AUDITOR'],
    created_at: '2026-01-05T08:30:00Z'
  },
  'compliance.auditor@vit.ac.in': {
    id: 'usr-auditor-04',
    email: 'compliance.auditor@vit.ac.in',
    full_name: 'Lead Compliance Auditor',
    is_active: true,
    roles: ['AUDITOR'],
    created_at: '2026-01-05T08:30:00Z'
  },
  'admin@privacyvault.local': {
    id: 'usr-admin-05',
    email: 'admin@privacyvault.local',
    full_name: 'System Administrator',
    is_active: true,
    roles: ['ADMIN', 'DATA_OWNER', 'ANALYST', 'AUDITOR'],
    created_at: '2026-01-01T00:00:00Z'
  }
};

// Default Dataset
const MOCK_DATASET: Dataset = {
  id: 'ehr-clinical-5000',
  name: 'Synthetic Clinical EHR Cohort',
  description: 'De-identified clinical health dataset containing 5,000 synthetic patient admissions with demographic, vitals, and diagnostic telemetry.',
  target_table: 'patient_clinical_records',
  owner_id: 'usr-owner-03',
  owner_name: 'Dr. V. Sivakumar (Data Custodian)',
  is_active: true,
  columns: [
    { id: 'c1', column_name: 'patient_id', data_type: 'UUID', is_sensitive: true, is_identifier: true, is_aggregatable: false },
    { id: 'c2', column_name: 'mrn', data_type: 'VARCHAR(20)', is_sensitive: true, is_identifier: true, is_aggregatable: false },
    { id: 'c3', column_name: 'age', data_type: 'INTEGER', is_sensitive: false, is_identifier: false, is_aggregatable: true, min_bound: 18, max_bound: 100 },
    { id: 'c4', column_name: 'gender', data_type: 'VARCHAR(10)', is_sensitive: false, is_identifier: false, is_aggregatable: true },
    { id: 'c5', column_name: 'admission_type', data_type: 'VARCHAR(20)', is_sensitive: false, is_identifier: false, is_aggregatable: true },
    { id: 'c6', column_name: 'diagnosis_code', data_type: 'VARCHAR(10)', is_sensitive: true, is_identifier: false, is_aggregatable: true },
    { id: 'c7', column_name: 'systolic_bp', data_type: 'INTEGER', is_sensitive: false, is_identifier: false, is_aggregatable: true, min_bound: 80, max_bound: 220 },
    { id: 'c8', column_name: 'los_days', data_type: 'INTEGER', is_sensitive: false, is_identifier: false, is_aggregatable: true, min_bound: 1, max_bound: 60 },
    { id: 'c9', column_name: 'treatment_cost', data_type: 'NUMERIC(10,2)', is_sensitive: false, is_identifier: false, is_aggregatable: true, min_bound: 100, max_bound: 150000 }
  ],
  active_policy: {
    id: 'pol-hipaa-01',
    name: 'HIPAA Differential Privacy Policy v1.4',
    max_epsilon_per_query: 2.0,
    default_delta: 1e-5,
    global_epsilon_cap: 10.0,
    sensitivity_clamp_low: 0,
    sensitivity_clamp_high: 220,
    approved_mechanisms: 'OPENDP_LAPLACE, OPENDP_GAUSSIAN',
    is_active: true
  }
};

// In-Memory State for Grants, Budgets, Queries, and Audit Events
let mockGrants: DatasetGrant[] = [
  {
    id: 'grant-krish-001',
    dataset_id: 'ehr-clinical-5000',
    dataset_name: 'Synthetic Clinical EHR Cohort',
    analyst_id: 'usr-krish-01',
    analyst_name: 'Krish (Lead Epidemiologist)',
    analyst_email: 'krish.24bce0846@vitstudent.ac.in',
    granted_at: '2026-02-01T10:00:00Z',
    expires_at: '2026-12-31T23:59:59Z',
    is_active: true,
    total_epsilon: 5.0,
    remaining_epsilon: 5.0
  },
  {
    id: 'grant-parv-002',
    dataset_id: 'ehr-clinical-5000',
    dataset_name: 'Synthetic Clinical EHR Cohort',
    analyst_id: 'usr-parv-02',
    analyst_name: 'Parv (Biostatistician)',
    analyst_email: 'parv.24bce0870@vitstudent.ac.in',
    granted_at: '2026-02-01T10:00:00Z',
    expires_at: '2026-12-31T23:59:59Z',
    is_active: true,
    total_epsilon: 5.0,
    remaining_epsilon: 5.0
  }
];

let mockQueryHistory: QueryRequestHistory[] = [];
let priorCohortSignatures: Set<string> = new Set();

let mockLedger: LedgerEntry[] = [
  {
    id: 'led-init-01',
    budget_id: 'bgt-krish-01',
    amount: 5.0,
    transaction_type: 'ALLOCATION',
    balance_after: 5.0,
    created_at: '2026-02-01T10:00:00Z'
  }
];

let mockAuditEvents: AuditEvent[] = [
  {
    id: 'aud-boot-01',
    event_timestamp: new Date(Date.now() - 3600000).toISOString(),
    actor_email: 'system@privacyvault.local',
    actor_name: 'System Kernel',
    event_type: 'GATEWAY_STARTUP',
    outcome: 'SUCCESS',
    details: { message: 'PrivacyVault Explainable Differential Privacy Gateway initialized successfully.' }
  },
  {
    id: 'aud-grant-02',
    event_timestamp: new Date(Date.now() - 1800000).toISOString(),
    actor_email: 'dataowner@privacyvault.local',
    actor_name: 'Dr. V. Sivakumar',
    event_type: 'GRANT_ISSUED',
    resource_id: 'grant-krish-001',
    outcome: 'SUCCESS',
    details: { allocated_epsilon: 5.0, analyst: 'krish.24bce0846@vitstudent.ac.in' }
  }
];

export class MockApiService {
  private currentUser: UserProfile | null = MOCK_USERS['krish.24bce0846@vitstudent.ac.in'];

  async login(email: string, _password: string): Promise<AuthTokenResponse> {
    const user = MOCK_USERS[email] || {
      id: `usr-${Math.random().toString(36).substring(2, 7)}`,
      email,
      full_name: email.split('@')[0],
      is_active: true,
      roles: ['ANALYST'],
      created_at: new Date().toISOString()
    };
    this.currentUser = user;

    mockAuditEvents.unshift({
      id: `aud-${Date.now()}`,
      event_timestamp: new Date().toISOString(),
      actor_email: user.email,
      actor_name: user.full_name,
      event_type: 'AUTH_LOGIN',
      outcome: 'SUCCESS',
      details: { roles: user.roles, client: 'Vercel Web Gateway' }
    });

    return {
      access_token: `pv_sim_token_${typeof window !== 'undefined' ? btoa(email) : 'token'}`,
      token_type: 'Bearer',
      expires_in: 43200,
      user
    };
  }

  async getCurrentUser(): Promise<UserProfile> {
    return this.currentUser || MOCK_USERS['krish.24bce0846@vitstudent.ac.in'];
  }

  async getHealth(): Promise<SystemHealth> {
    return {
      status: 'HEALTHY',
      service: 'PrivacyVault Differential Privacy Gateway (Web Cloud Edition)',
      version: '1.0.0',
      database: {
        connected: true,
        runtime_user: 'privacyvault_app (Restricted RLS Role)',
        database_name: 'privacyvault_analytics',
        engine: 'PostgreSQL 17.2 + OpenDP 0.16.0 Framework'
      },
      authors: 'KRISH (24BCE0846) & PARV (24BCE0870)',
      slot: 'L25+L26',
      academic_course: 'BCSE302P Database Systems Lab',
      differential_privacy_engine: 'OpenDP Laplace / Gaussian Mechanism Active'
    };
  }

  async listDatasets(): Promise<Dataset[]> {
    return [MOCK_DATASET];
  }

  async getDataset(_id: string): Promise<Dataset> {
    return MOCK_DATASET;
  }

  async getMyGrants(): Promise<DatasetGrant[]> {
    const email = this.currentUser?.email || 'krish.24bce0846@vitstudent.ac.in';
    const userGrants = mockGrants.filter(g => g.analyst_email === email && g.is_active);
    if (userGrants.length === 0 && mockGrants.length > 0) {
      return [mockGrants[0]];
    }
    return userGrants;
  }

  async issueGrant(data: { dataset_id: string; analyst_email: string; expires_in_days: number; allocated_epsilon: number }): Promise<DatasetGrant> {
    const newGrant: DatasetGrant = {
      id: `grant-${Date.now().toString(36)}`,
      dataset_id: data.dataset_id,
      dataset_name: MOCK_DATASET.name,
      analyst_id: `usr-${Date.now().toString(36)}`,
      analyst_name: data.analyst_email.split('@')[0],
      analyst_email: data.analyst_email,
      granted_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + data.expires_in_days * 86400000).toISOString(),
      is_active: true,
      total_epsilon: data.allocated_epsilon,
      remaining_epsilon: data.allocated_epsilon
    };
    mockGrants.push(newGrant);
    mockAuditEvents.unshift({
      id: `aud-${Date.now()}`,
      event_timestamp: new Date().toISOString(),
      actor_email: this.currentUser?.email || 'dataowner@privacyvault.local',
      actor_name: this.currentUser?.full_name || 'Data Owner',
      event_type: 'GRANT_ISSUED',
      resource_id: newGrant.id,
      outcome: 'SUCCESS',
      details: { analyst: data.analyst_email, epsilon: data.allocated_epsilon }
    });
    return newGrant;
  }

  async revokeGrant(id: string): Promise<{ message: string }> {
    const grant = mockGrants.find(g => g.id === id);
    if (grant) {
      grant.is_active = false;
    }
    mockAuditEvents.unshift({
      id: `aud-${Date.now()}`,
      event_timestamp: new Date().toISOString(),
      actor_email: this.currentUser?.email || 'dataowner@privacyvault.local',
      actor_name: this.currentUser?.full_name || 'Data Owner',
      event_type: 'GRANT_REVOKED',
      resource_id: id,
      outcome: 'SUCCESS',
      details: { grant_id: id, reason: 'Manual revocation by Data Owner' }
    });
    return { message: `Grant ${id} has been revoked successfully.` };
  }

  async validateQuery(data: AggregateQueryRequest): Promise<QueryValidationResponse> {
    if (data.target_column === 'mrn' || data.filters.some(f => f.column === 'mrn' || f.column === 'patient_id')) {
      return {
        valid: false,
        error: "Disallowed identifier column 'mrn': Direct patient identifiers are blocked by schema security rules.",
        risk_level: 'CRITICAL',
        risk_summary: 'Direct identifier aggregation blocked by Database Schema Security Model.',
        differencing_detected: false,
        estimated_epsilon: data.requested_epsilon
      };
    }
    return {
      valid: true,
      risk_level: 'LOW',
      risk_summary: 'Standard aggregate query within allowed privacy sensitivity bounds.',
      differencing_detected: false,
      estimated_epsilon: data.requested_epsilon
    };
  }

  async submitQuery(data: AggregateQueryRequest): Promise<QueryRelease> {
    // 1. Direct Identifier Attack Defense (Scenario B)
    if (data.target_column === 'mrn' || data.filters.some(f => f.column === 'mrn' || f.column === 'patient_id')) {
      mockAuditEvents.unshift({
        id: `aud-${Date.now()}`,
        event_timestamp: new Date().toISOString(),
        actor_email: this.currentUser?.email || 'unknown',
        actor_name: this.currentUser?.full_name || 'Analyst',
        event_type: 'IDENTIFIER_ACCESS_ATTEMPT',
        outcome: 'DENIED',
        details: { target_column: data.target_column, reason: 'Database Schema Identifier Protection' }
      });
      const error: any = new Error("Direct patient identifier 'mrn' cannot be queried or aggregated. Column is protected by privacy rules.");
      error.status = 403;
      error.payload = {
        error: "Direct patient identifier 'mrn' cannot be queried or aggregated.",
        defense: 'Database Schema Identifier Protection',
        raw_records_exposed: 0
      };
      throw error;
    }

    // 2. Dynamic Grant Revocation Check (Scenario F)
    const grant = mockGrants.find(g => g.id === data.grant_id) || mockGrants[0];
    if (!grant || !grant.is_active) {
      mockAuditEvents.unshift({
        id: `aud-${Date.now()}`,
        event_timestamp: new Date().toISOString(),
        actor_email: this.currentUser?.email || 'unknown',
        event_type: 'QUERY_SUBMIT_REVOKED_GRANT',
        outcome: 'DENIED',
        details: { grant_id: data.grant_id }
      });
      const error: any = new Error(`Grant '${data.grant_id}' has been revoked or expired.`);
      error.status = 403;
      throw error;
    }

    // 3. Differencing Reconstruction Attack Defense (Scenario C)
    const filterCols = data.filters.map(f => `${f.column}:${f.operator}:${f.value}`).sort().join(';');
    const isZ99 = data.filters.some(f => f.column === 'diagnosis_code' && f.value === 'Z99');
    const isEmergency = data.filters.some(f => f.column === 'admission_type' && f.value === 'EMERGENCY');

    if (isZ99 && isEmergency && priorCohortSignatures.has('Z99_BASE')) {
      mockAuditEvents.unshift({
        id: `aud-${Date.now()}`,
        event_timestamp: new Date().toISOString(),
        actor_email: this.currentUser?.email || 'unknown',
        actor_name: this.currentUser?.full_name || 'Analyst',
        event_type: 'DIFFERENCING_ATTACK_HALTED',
        outcome: 'DENIED',
        details: {
          cohort: 'Z99',
          exclusion_predicate: 'admission_type = EMERGENCY',
          risk_engine: 'Query-History Differencing Detector'
        }
      });
      const error: any = new Error('CRITICAL Differencing Risk: Query overlaps prior cohort within epsilon threshold, enabling record reconstruction.');
      error.status = 400;
      error.payload = {
        error: 'CRITICAL Differencing Risk: Query overlaps prior cohort within epsilon threshold, enabling record reconstruction.',
        risk_level: 'CRITICAL',
        recommended_action: 'Increase cohort generalization or broaden predicate filters.'
      };
      throw error;
    }

    if (isZ99) {
      priorCohortSignatures.add('Z99_BASE');
    }

    // 4. Privacy Budget Exhaustion Check (Scenario D)
    const requestedEps = data.requested_epsilon || 0.5;
    if (grant.remaining_epsilon < requestedEps || grant.remaining_epsilon <= 0) {
      mockAuditEvents.unshift({
        id: `aud-${Date.now()}`,
        event_timestamp: new Date().toISOString(),
        actor_email: this.currentUser?.email || 'unknown',
        event_type: 'BUDGET_EXHAUSTED_DENIAL',
        outcome: 'DENIED',
        details: { requested_epsilon: requestedEps, remaining_epsilon: grant.remaining_epsilon }
      });
      const error: any = new Error(`Privacy budget exhausted. Requested ${requestedEps} epsilon exceeds remaining balance of ${grant.remaining_epsilon.toFixed(2)}.`);
      error.status = 403;
      error.payload = {
        error: 'Privacy budget exhausted. Quota limit reached.',
        remaining_epsilon: grant.remaining_epsilon,
        requested_epsilon: requestedEps
      };
      throw error;
    }

    // Deduct Epsilon from Budget
    grant.remaining_epsilon = Math.max(0, Math.round((grant.remaining_epsilon - requestedEps) * 1000) / 1000);

    // 5. Differential Privacy Mathematics (OpenDP Laplace Mechanism)
    const sensitivity = data.metric === 'COUNT' ? 1.0 : (data.metric === 'BOUNDED_AVG' ? 0.05 : 100.0);
    const noiseScale = sensitivity / requestedEps;

    // Sample symmetric Laplace distribution: f(x) = 1/(2b) * exp(-|x|/b)
    const u = Math.random() - 0.5;
    const laplaceNoise = -noiseScale * Math.sign(u) * Math.log(1 - 2 * Math.abs(u));

    let trueResult = 1420; // Default emergency admissions
    if (isZ99) trueResult = 24;
    else if (data.metric === 'BOUNDED_AVG') trueResult = 54.2;
    else if (data.metric === 'BOUNDED_SUM') trueResult = 72480;

    const noisyResult = Math.max(0, Math.round((trueResult + laplaceNoise) * 100) / 100);
    const releaseId = `rel-${Date.now().toString(36)}`;

    const release: QueryRelease = {
      id: releaseId,
      request_id: data.request_id || `req-${Date.now()}`,
      metric: data.metric,
      target_column: data.target_column,
      noisy_result: noisyResult,
      mechanism_used: 'OPENDP_LAPLACE',
      noise_scale: Math.round(noiseScale * 1000) / 1000,
      sensitivity_applied: sensitivity,
      epsilon_spent: requestedEps,
      delta_spent: 0.0,
      released_at: new Date().toISOString(),
      risk_level: 'LOW',
      risk_summary: 'Satisfies standard epsilon-differential privacy via calibrated OpenDP Laplace noise addition.',
      author_signature: `HMAC_SHA256_SECDEF_${Math.random().toString(36).substring(2, 10).toUpperCase()}`
    };

    mockQueryHistory.unshift({
      id: `hist-${Date.now()}`,
      grant_id: grant.id,
      analyst_id: grant.analyst_id,
      metric: data.metric,
      target_column: data.target_column,
      filter_criteria: data.filters,
      requested_epsilon: requestedEps,
      requested_delta: 0.0,
      status: 'RELEASED',
      risk_level: 'LOW',
      risk_summary: 'Differential privacy release verified.',
      created_at: new Date().toISOString(),
      release
    });

    mockLedger.unshift({
      id: `led-${Date.now()}`,
      budget_id: grant.id,
      request_id: data.request_id,
      amount: requestedEps,
      transaction_type: 'COMMIT',
      balance_after: grant.remaining_epsilon,
      created_at: new Date().toISOString()
    });

    mockAuditEvents.unshift({
      id: `aud-${Date.now()}`,
      event_timestamp: new Date().toISOString(),
      actor_email: this.currentUser?.email || 'unknown',
      actor_name: this.currentUser?.full_name || 'Analyst',
      event_type: 'QUERY_RELEASE',
      resource_id: releaseId,
      outcome: 'SUCCESS',
      details: {
        metric: data.metric,
        epsilon_spent: requestedEps,
        mechanism: 'OPENDP_LAPLACE',
        noise_scale: release.noise_scale
      }
    });

    return release;
  }

  async getMyQueryHistory(): Promise<QueryRequestHistory[]> {
    return mockQueryHistory;
  }

  async getMyBudgetSummary(): Promise<BudgetSummary[]> {
    const grants = await this.getMyGrants();
    return grants.map(g => ({
      grant_id: g.id,
      analyst_id: g.analyst_id,
      analyst_name: g.analyst_name,
      analyst_email: g.analyst_email,
      dataset_id: g.dataset_id,
      dataset_name: g.dataset_name,
      budget_id: `bgt-${g.id}`,
      total_epsilon: g.total_epsilon,
      remaining_epsilon: g.remaining_epsilon,
      spent_epsilon: Math.round((g.total_epsilon - g.remaining_epsilon) * 1000) / 1000,
      budget_utilization_pct: Math.round(((g.total_epsilon - g.remaining_epsilon) / g.total_epsilon) * 100),
      expires_at: g.expires_at,
      grant_active: g.is_active,
      last_budget_activity: new Date().toISOString()
    }));
  }

  async getAllBudgetSummaries(): Promise<BudgetSummary[]> {
    return mockGrants.map(g => ({
      grant_id: g.id,
      analyst_id: g.analyst_id,
      analyst_name: g.analyst_name,
      analyst_email: g.analyst_email,
      dataset_id: g.dataset_id,
      dataset_name: g.dataset_name,
      budget_id: `bgt-${g.id}`,
      total_epsilon: g.total_epsilon,
      remaining_epsilon: g.remaining_epsilon,
      spent_epsilon: Math.round((g.total_epsilon - g.remaining_epsilon) * 1000) / 1000,
      budget_utilization_pct: Math.round(((g.total_epsilon - g.remaining_epsilon) / g.total_epsilon) * 100),
      expires_at: g.expires_at,
      grant_active: g.is_active,
      last_budget_activity: new Date().toISOString()
    }));
  }

  async getBudgetLedger(_budgetId: string): Promise<LedgerEntry[]> {
    return mockLedger;
  }

  async getAuditEvents(eventType?: string, outcome?: string): Promise<AuditEvent[]> {
    let events = [...mockAuditEvents];
    if (eventType) {
      events = events.filter(e => e.event_type === eventType);
    }
    if (outcome) {
      events = events.filter(e => e.outcome === outcome);
    }
    return events;
  }
}

export const mockApi = new MockApiService();
