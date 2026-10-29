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
import { mockApi } from './mockApi';

const API_BASE = '/api/v1';

class ApiService {
  private token: string | null = null;
  private authListeners: Array<(token: string | null) => void> = [];
  private useSimulationFallback: boolean = false;

  constructor() {
    this.token = localStorage.getItem('pv_token');
    // If running on Vercel or hosted web preview without a custom API backend, default to simulation fallback
    if (typeof window !== 'undefined' && window.location.hostname.includes('vercel.app')) {
      this.useSimulationFallback = true;
    }
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
    if (this.useSimulationFallback) {
      return this.dispatchMock<T>(endpoint, options);
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {})
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    try {
      const response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers
      });

      const contentType = response.headers.get('content-type') || '';
      // If the endpoint returned HTML (e.g. index.html from SPA fallback), fallback to simulation
      if (contentType.includes('text/html')) {
        this.useSimulationFallback = true;
        return this.dispatchMock<T>(endpoint, options);
      }

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

        if (response.status === 401) {
          this.setToken(null);
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('pv_session_expired', { detail: error.message }));
          }
        }

        throw error;
      }

      return response.json();
    } catch (err: any) {
      // If network failed completely (no backend listening), activate simulation fallback
      if (err.message === 'Failed to fetch' || err.message?.includes('NetworkError') || err.message === 'API Request Failed') {
        this.useSimulationFallback = true;
        return this.dispatchMock<T>(endpoint, options);
      }
      throw err;
    }
  }

  private async dispatchMock<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const body = options.body ? JSON.parse(options.body as string) : {};

    if (endpoint.startsWith('/health')) {
      return (await mockApi.getHealth()) as unknown as T;
    }
    if (endpoint.startsWith('/auth/login-json')) {
      return (await mockApi.login(body.email, body.password)) as unknown as T;
    }
    if (endpoint.startsWith('/auth/me')) {
      return (await mockApi.getCurrentUser()) as unknown as T;
    }
    if (endpoint === '/datasets') {
      return (await mockApi.listDatasets()) as unknown as T;
    }
    if (endpoint.startsWith('/datasets/') && !endpoint.includes('grants')) {
      const id = endpoint.split('/')[2];
      return (await mockApi.getDataset(id)) as unknown as T;
    }
    if (endpoint.startsWith('/datasets/my-grants')) {
      return (await mockApi.getMyGrants()) as unknown as T;
    }
    if (endpoint === '/datasets/grants' && options.method === 'POST') {
      return (await mockApi.issueGrant(body)) as unknown as T;
    }
    if (endpoint.includes('/grants/') && endpoint.endsWith('/revoke')) {
      const id = endpoint.split('/')[3];
      return (await mockApi.revokeGrant(id)) as unknown as T;
    }
    if (endpoint.startsWith('/queries/validate')) {
      return (await mockApi.validateQuery(body)) as unknown as T;
    }
    if (endpoint.startsWith('/queries/submit')) {
      return (await mockApi.submitQuery(body)) as unknown as T;
    }
    if (endpoint.startsWith('/queries/history/my')) {
      return (await mockApi.getMyQueryHistory()) as unknown as T;
    }
    if (endpoint.startsWith('/budgets/my-summary')) {
      return (await mockApi.getMyBudgetSummary()) as unknown as T;
    }
    if (endpoint.startsWith('/budgets/all-summaries')) {
      return (await mockApi.getAllBudgetSummaries()) as unknown as T;
    }
    if (endpoint.includes('/budgets/') && endpoint.endsWith('/ledger')) {
      const id = endpoint.split('/')[2];
      return (await mockApi.getBudgetLedger(id)) as unknown as T;
    }
    if (endpoint.startsWith('/audit/events')) {
      const url = new URL(`http://dummy${endpoint}`);
      const eventType = url.searchParams.get('event_type') || undefined;
      const outcome = url.searchParams.get('outcome') || undefined;
      return (await mockApi.getAuditEvents(eventType, outcome)) as unknown as T;
    }

    throw new Error(`Endpoint not found in mock simulation: ${endpoint}`);
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
