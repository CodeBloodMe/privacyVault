export type RoleType = 'ADMIN' | 'DATA_OWNER' | 'ANALYST' | 'AUDITOR';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  is_active: boolean;
  roles: RoleType[];
  created_at: string;
}

export interface AuthTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  user: UserProfile;
}

export interface ColumnMetadata {
  id: string;
  column_name: string;
  data_type: string;
  is_sensitive: boolean;
  is_identifier: boolean;
  is_aggregatable: boolean;
  min_bound?: number;
  max_bound?: number;
}

export interface PrivacyPolicy {
  id: string;
  name: string;
  max_epsilon_per_query: number;
  default_delta: number;
  global_epsilon_cap: number;
  sensitivity_clamp_low: number;
  sensitivity_clamp_high: number;
  approved_mechanisms: string;
  is_active: boolean;
}

export interface Dataset {
  id: string;
  name: string;
  description?: string;
  target_table: string;
  owner_id: string;
  owner_name?: string;
  is_active: boolean;
  columns: ColumnMetadata[];
  active_policy?: PrivacyPolicy;
}

export interface DatasetGrant {
  id: string;
  dataset_id: string;
  dataset_name: string;
  analyst_id: string;
  analyst_name: string;
  analyst_email: string;
  granted_at: string;
  expires_at: string;
  is_active: boolean;
  total_epsilon: number;
  remaining_epsilon: number;
}

export type MetricType = 'COUNT' | 'BOUNDED_SUM' | 'BOUNDED_AVG';
export type FilterOperator = 'EQ' | 'NEQ' | 'GT' | 'GTE' | 'LT' | 'LTE' | 'IN';

export interface FilterCriterion {
  column: string;
  operator: FilterOperator;
  value: any;
}

export interface AggregateQueryRequest {
  request_id?: string;
  grant_id: string;
  metric: MetricType;
  target_column?: string;
  filters: FilterCriterion[];
  requested_epsilon: number;
  requested_delta: number;
}

export interface QueryValidationResponse {
  valid: boolean;
  error?: string;
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  risk_summary?: string;
  differencing_detected: boolean;
  estimated_epsilon: number;
}

export interface QueryRelease {
  id: string;
  request_id: string;
  metric: string;
  target_column?: string;
  noisy_result: number;
  mechanism_used: string;
  noise_scale: number;
  sensitivity_applied: number;
  epsilon_spent: number;
  delta_spent: number;
  released_at: string;
  risk_level: string;
  risk_summary?: string;
  author_signature: string;
}

export interface QueryRequestHistory {
  id: string;
  grant_id: string;
  analyst_id: string;
  metric: string;
  target_column?: string;
  filter_criteria: FilterCriterion[];
  requested_epsilon: number;
  requested_delta: number;
  status: string;
  risk_level: string;
  risk_summary?: string;
  created_at: string;
  release?: QueryRelease;
}

export interface BudgetSummary {
  grant_id: string;
  analyst_id: string;
  analyst_name: string;
  analyst_email: string;
  dataset_id: string;
  dataset_name: string;
  budget_id: string;
  total_epsilon: number;
  remaining_epsilon: number;
  spent_epsilon: number;
  budget_utilization_pct: number;
  expires_at: string;
  grant_active: boolean;
  last_budget_activity: string;
}

export interface LedgerEntry {
  id: string;
  budget_id: string;
  request_id?: string;
  amount: number;
  transaction_type: 'ALLOCATION' | 'RESERVATION' | 'COMMIT' | 'REFUND';
  balance_after: number;
  created_at: string;
}

export interface AuditEvent {
  id: string;
  event_timestamp: string;
  actor_user_id?: string;
  actor_email?: string;
  actor_name?: string;
  event_type: string;
  resource_type?: string;
  resource_id?: string;
  outcome: 'SUCCESS' | 'DENIED' | 'ERROR';
  client_ip?: string;
  details: Record<string, any>;
}

export interface SystemHealth {
  status: string;
  service: string;
  version: string;
  database: {
    connected: boolean;
    runtime_user: string;
    database_name: string;
    engine: string;
  };
  authors: string;
  slot: string;
  academic_course: string;
  differential_privacy_engine: string;
}
