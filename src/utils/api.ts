import {
  User,
  DatasetMetadata,
  DatasetStatistics,
  CorrelationMatrix,
  AnomalyAnalysis,
  Report,
  AuditLog,
  SystemStats,
  SavedAnalysis,
  CleanResult,
  ChartType
} from '../types.js';

let authToken: string | null = typeof window !== 'undefined' ? localStorage.getItem('df95_token') : null;

export function setStoredToken(token: string | null) {
  authToken = token;
  if (typeof window !== 'undefined') {
    if (token) {
      localStorage.setItem('df95_token', token);
    } else {
      localStorage.removeItem('df95_token');
    }
  }
}

export function getStoredToken(): string | null {
  return authToken;
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  const headers: Record<string, string> = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(options.headers as Record<string, string> || {})
  };

  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  let res: Response;
  try {
    res = await fetch(endpoint, {
      ...options,
      headers
    });
  } catch (err: any) {
    throw new Error('Unable to connect to the server. Please try again.');
  }

  let data: any = {};
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      data = await res.json();
    } catch {
      data = { error: res.statusText };
    }
  } else {
    try {
      const text = await res.text();
      if (text.startsWith('<!doctype') || text.startsWith('<html') || text.includes('<html')) {
        data = { error: `Server error (${res.status}): Please check backend logs.` };
      } else {
        data = { error: text || res.statusText };
      }
    } catch {
      data = { error: res.statusText };
    }
  }

  if (!res.ok) {
    if (res.status === 401 && endpoint !== '/api/auth/login') {
      setStoredToken(null);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('df95:unauthorized'));
      }
    }
    throw new Error(data.error || `HTTP error ${res.status}: ${res.statusText}`);
  }
  return data as T;
}

export const api = {
  // Auth
  login: (emailOrUsername: string, password: string) =>
    request<{ token: string; user: User }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: emailOrUsername,
        username: emailOrUsername,
        identifier: emailOrUsername,
        password
      })
    }),
  logout: async () => {
    try {
      await request<{ message: string }>('/api/auth/logout', { method: 'POST' });
    } catch {
      // Ignore network errors on logout
    } finally {
      setStoredToken(null);
    }
  },
  getMe: () =>
    request<{ user: User }>('/api/auth/me'),
  register: (payload: { username?: string; password: string; fullName?: string; email: string; department?: string }) =>
    request<{ token: string; user: User }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  forgotPassword: (username: string) =>
    request<{ message: string; temporaryPassword?: string; instructions: string }>('/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ username })
    }),

  // Categories
  getCategories: () =>
    request<string[]>('/api/categories'),
  addCategory: (name: string) =>
    request<{ name: string; allCategories: string[] }>('/api/categories', {
      method: 'POST',
      body: JSON.stringify({ name })
    }),

  // Datasets
  getDatasets: (params?: { category?: string; search?: string; scope?: string; includeDemo?: boolean }) => {
    const q = new URLSearchParams();
    if (params?.category && params.category !== 'ALL') q.set('category', params.category);
    if (params?.search) q.set('search', params.search);
    if (params?.scope) q.set('scope', params.scope);
    if (params?.includeDemo !== undefined) q.set('includeDemo', String(params.includeDemo));
    return request<DatasetMetadata[]>(`/api/datasets?${q.toString()}`);
  },
  toggleFavoriteDataset: (id: string) =>
    request<{ success: boolean; isLiked: boolean; favoriteDatasetIds: string[] }>(`/api/datasets/${id}/favorite`, {
      method: 'POST'
    }),
  dismissDataset: (id: string) =>
    request<{ success: boolean; dismissedDatasetIds: string[] }>(`/api/datasets/${id}/dismiss`, {
      method: 'POST'
    }),
  restoreSampleDatasets: () =>
    request<{ success: boolean }>('/api/datasets/restore-samples', {
      method: 'POST'
    }),
  updatePreferences: (prefs: { hideSampleDatasets?: boolean }) =>
    request<{ success: boolean; user: User }>('/api/user/preferences', {
      method: 'PATCH',
      body: JSON.stringify(prefs)
    }),
  getDatasetDetails: (id: string, params?: { page?: number; pageSize?: number; search?: string; sortCol?: string; sortDir?: string }) => {
    const q = new URLSearchParams();
    if (params?.page) q.set('page', String(params.page));
    if (params?.pageSize) q.set('pageSize', String(params.pageSize));
    if (params?.search) q.set('search', params.search);
    if (params?.sortCol) q.set('sortCol', params.sortCol);
    if (params?.sortDir) q.set('sortDir', params.sortDir);
    return request<{
      metadata: DatasetMetadata;
      page: number;
      pageSize: number;
      totalRecords: number;
      totalFiltered: number;
      totalPages: number;
      records: any[];
    }>(`/api/datasets/${id}?${q.toString()}`);
  },
  uploadDatasetFile: (formData: FormData) =>
    request<{ success: boolean; message: string; metadata: DatasetMetadata; dataset?: any }>('/api/datasets/upload', {
      method: 'POST',
      body: formData
    }),
  uploadDataset: (payload: {
    name: string;
    description: string;
    category: string;
    source: string;
    fileType: string;
    rawContent?: string;
    base64Content?: string;
    isShared?: boolean;
  }) =>
    request<{ success?: boolean; message: string; metadata: DatasetMetadata; dataset?: any }>('/api/datasets/upload', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  updateDataset: (id: string, payload: { name?: string; description?: string; category?: string; source?: string; isShared?: boolean }) =>
    request<{ message: string; metadata: DatasetMetadata }>(`/api/datasets/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    }),
  deleteDataset: (id: string) =>
    request<{ message: string }>(`/api/datasets/${id}`, { method: 'DELETE' }),
  cleanDataset: (
    id: string,
    action: 'DEDUPLICATE' | 'DROP_MISSING' | 'IMPUTE_MEAN' | 'IMPUTE_MEDIAN' | 'TRIM_WHITESPACE' | 'NORMALIZE_NAMES' | 'DROP_OUTLIERS',
    column?: string
  ) =>
    request<CleanResult>(`/api/datasets/${id}/clean`, {
      method: 'POST',
      body: JSON.stringify({ action, column })
    }),
  downloadDataset: async (id: string, format: 'csv' | 'json', datasetName: string) => {
    const headers: Record<string, string> = {};
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }
    const res = await fetch(`/api/datasets/${id}/export?format=${format}`, { headers });
    if (!res.ok) {
      throw new Error(`Export failed (${res.status}): ${res.statusText}`);
    }
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${datasetName.replace(/[^a-zA-Z0-9_-]/g, '_')}_export.${format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  },

  // Saved Analyses & Charts
  runAnalysis: (datasetId: string) =>
    request<{
      success: boolean;
      datasetId: string;
      metadata: DatasetMetadata;
      statistics: DatasetStatistics;
      correlation: CorrelationMatrix;
      anomalies: AnomalyAnalysis;
      analyzedAt: string;
    }>('/api/analysis', {
      method: 'POST',
      body: JSON.stringify({ datasetId })
    }),
  getAnalyses: (datasetId?: string) => {
    const q = new URLSearchParams();
    if (datasetId) q.set('datasetId', datasetId);
    return request<SavedAnalysis[]>(`/api/analyses?${q.toString()}`);
  },
  createAnalysis: (payload: {
    datasetId: string;
    title: string;
    analysisType: string;
    selectedColumns: string[];
    filters?: Record<string, any>;
    chartType: ChartType;
    config: Record<string, any>;
  }) =>
    request<SavedAnalysis>('/api/analyses', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  getAnalysis: (id: string) =>
    request<SavedAnalysis>(`/api/analyses/${id}`),
  deleteAnalysis: (id: string) =>
    request<{ message: string }>(`/api/analyses/${id}`, { method: 'DELETE' }),

  // Analytics & Stats
  getStatistics: (id: string) =>
    request<DatasetStatistics>(`/api/datasets/${id}/statistics`),
  getCorrelation: (id: string) =>
    request<CorrelationMatrix>(`/api/datasets/${id}/correlation`),
  getAnomalies: (id: string) =>
    request<AnomalyAnalysis>(`/api/datasets/${id}/anomalies`),
  getChartData: (id: string, params?: { xAxis: string; yAxis?: string; aggregation?: string }) => {
    const q = new URLSearchParams();
    if (params?.xAxis) q.set('xAxis', params.xAxis);
    if (params?.yAxis) q.set('yAxis', params.yAxis);
    if (params?.aggregation) q.set('aggregation', params.aggregation);
    return request<{ xAxis: string; yAxis?: string; aggregation?: string; chartData: { label: string; value: number; count?: number }[] }>(
      `/api/datasets/${id}/charts?${q.toString()}`
    );
  },

  // Overview
  getOverview: () =>
    request<{
      stats: SystemStats;
      recentDatasets: DatasetMetadata[];
      recentAuditLogs: AuditLog[];
    }>('/api/analytics/overview'),

  // Reports
  getReports: () =>
    request<Report[]>('/api/reports'),
  createReport: (datasetId: string, title?: string, customNotes?: string) =>
    request<Report>('/api/reports', {
      method: 'POST',
      body: JSON.stringify({ datasetId, title, customNotes })
    }),
  getReport: (id: string) =>
    request<Report>(`/api/reports/${id}`),

  // Audit Logs (Admin)
  getAuditLogs: () =>
    request<AuditLog[]>('/api/audit-logs'),

  // Users (Admin)
  getUsers: () =>
    request<User[]>('/api/users'),
  createUser: (payload: any) =>
    request<User>('/api/users', { method: 'POST', body: JSON.stringify(payload) }),
  updateUser: (id: string, payload: any) =>
    request<User>(`/api/users/${id}`, { method: 'PATCH', body: JSON.stringify(payload) })
};
