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

const API_BASE = '/api/v1';

class ApiService {
  private token: string | null = null;
  private authListeners: Array<(token: string | null) => void> = [];

  constructor() {
    this.token = localStorage.getItem('pv_token');
  }

  onAuthStateChanged(listener: (token: string | null) => void): () => void {
    this.authListeners.push(listener);
    return () => {
      this.authListeners = this.authListeners.filter(l => l !== listener);
    };
  }

  setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem('pv_token', token);
    } else {
      localStorage.removeItem('pv_token');
      localStorage.removeItem('pv_user');
    }
    this.authListeners.forEach(listener => {
      try {
        listener(token);
      } catch (err) {
        console.error('Error in auth listener:', err);
      }
    });
  }

  getToken(): string | null {
    return this.token;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {})
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers
    });

    if (!response.ok) {
      let errorBody: any;
      try {
        errorBody = await response.json();
      } catch {
        errorBody = { message: response.statusText };
      }
      const error: any = new Error(
        typeof errorBody.detail === 'string'
          ? errorBody.detail
          : errorBody.detail?.error || errorBody.message || 'API Request Failed'
      );
      error.status = response.status;
      error.payload = errorBody.detail || errorBody;

      // Cleanly handle session expiration or invalid credential tokens
      if (response.status === 401) {
        this.setToken(null);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('pv_session_expired', { detail: error.message }));
        }
      }

      throw error;
    }

    return response.json();
  }

  // Auth
  async login(email: string, password: string): Promise<AuthTokenResponse> {
    const res = await this.request<AuthTokenResponse>('/auth/login-json', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    this.setToken(res.access_token);
    return res;
  }

  async getCurrentUser(): Promise<UserProfile> {
    return this.request<UserProfile>('/auth/me');
  }

  logout() {
    this.setToken(null);
  }

  // Health
  async getHealth(): Promise<SystemHealth> {
    return this.request<SystemHealth>('/health');
  }

  // Datasets & Grants
  async listDatasets(): Promise<Dataset[]> {
    return this.request<Dataset[]>('/datasets');
  }

  async getDataset(id: string): Promise<Dataset> {
    return this.request<Dataset>(`/datasets/${id}`);
  }

  async getMyGrants(): Promise<DatasetGrant[]> {
    return this.request<DatasetGrant[]>('/datasets/my-grants');
  }

  async issueGrant(data: { dataset_id: string; analyst_email: string; expires_in_days: number; allocated_epsilon: number }): Promise<DatasetGrant> {
    return this.request<DatasetGrant>('/datasets/grants', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async revokeGrant(id: string): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/datasets/grants/${id}/revoke`, {
      method: 'POST'
    });
  }

  // Queries & Privacy Gateway
  async validateQuery(data: AggregateQueryRequest): Promise<QueryValidationResponse> {
    return this.request<QueryValidationResponse>('/queries/validate', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async submitQuery(data: AggregateQueryRequest): Promise<QueryRelease> {
    return this.request<QueryRelease>('/queries/submit', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async getMyQueryHistory(): Promise<QueryRequestHistory[]> {
    return this.request<QueryRequestHistory[]>('/queries/history/my');
  }

  // Budgets & Ledger
  async getMyBudgetSummary(): Promise<BudgetSummary[]> {
    return this.request<BudgetSummary[]>('/budgets/my-summary');
  }

  async getAllBudgetSummaries(): Promise<BudgetSummary[]> {
    return this.request<BudgetSummary[]>('/budgets/all-summaries');
  }

  async getBudgetLedger(budgetId: string): Promise<LedgerEntry[]> {
    return this.request<LedgerEntry[]>(`/budgets/${budgetId}/ledger`);
  }

  // Audit Events
  async getAuditEvents(eventType?: string, outcome?: string): Promise<AuditEvent[]> {
    const params = new URLSearchParams();
    if (eventType) params.append('event_type', eventType);
    if (outcome) params.append('outcome', outcome);
    const qs = params.toString();
    return this.request<AuditEvent[]>(`/audit/events${qs ? `?${qs}` : ''}`);
  }
}

export const api = new ApiService();
