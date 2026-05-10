// API client for backend integration
// Use relative /api path so requests go through Next.js rewrites to backend
const API_BASE_URL = '/api';

// ── Pagination ────────────────────────────────────────────────────────────────

export interface PagedResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  last: boolean;
}

/** Unwraps a PagedResponse or plain array — handles both old and new backend responses. */
function unwrapPage<T>(data: PagedResponse<T> | T[]): T[] {
  if (Array.isArray(data)) return data;
  return data.content ?? [];
}

// ── Auth state helpers ────────────────────────────────────────────────────────

function getStoredState(): { token: string | null; user: any | null } {
  if (typeof window === 'undefined') return { token: null, user: null };
  try {
    const stored = localStorage.getItem('auth-storage');
    if (!stored) return { token: null, user: null };
    const parsed = JSON.parse(stored);
    return {
      token: parsed?.state?.token ?? null,
      user: parsed?.state?.user ?? null,
    };
  } catch {
    return { token: null, user: null };
  }
}

function getToken(): string | null {
  const token = getStoredState().token;
  if (!token) return null;
  
  // Validate JWT token format (must have exactly 2 periods)
  const parts = token.split('.');
  if (parts.length !== 3) {
    console.error('Invalid JWT token format - clearing authentication');
    handleAuthError();
    return null;
  }
  
  // Basic validation of each part (should be base64)
  for (const part of parts) {
    if (!part || part.length === 0) {
      console.error('Invalid JWT token structure - clearing authentication');
      handleAuthError();
      return null;
    }
  }
  
  return token;
}

function getUserId(): string | null {
  const user = getStoredState().user;
  if (!user) return null;
  const raw = user.id || user.userId;
  if (!raw && raw !== 0) return null;
  const str = String(raw);
  return str.trim() !== '' ? str : null;
}

/** Returns the role string stored in the auth state (e.g. "MANAGER") */
function getUserRole(): string | null {
  const user = getStoredState().user;
  if (!user) return null;
  const raw = user.role || user.roleName;
  if (!raw) return null;
  const str = String(raw).trim();
  return str !== '' ? str : null;
}

// ── Auth error handler ────────────────────────────────────────────────────────

function handleAuthError() {
  console.warn('Authentication error detected - clearing session');
  if (typeof window !== 'undefined') {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { useAuthStore } = require('@/lib/auth-store');
      useAuthStore.getState().logout();
    } catch {
      localStorage.removeItem('auth-storage');
    }
    // Clear any remaining auth data
    localStorage.removeItem('auth-storage');
    sessionStorage.removeItem('sessionActive');
    window.location.href = '/login';
  }
}

// Function to manually clear invalid authentication
export function clearInvalidAuth() {
  console.warn('Clearing invalid authentication data');
  if (typeof window !== 'undefined') {
    localStorage.removeItem('auth-storage');
    sessionStorage.removeItem('sessionActive');
    window.location.href = '/login';
  }
}

// ── Generic fetch wrapper ─────────────────────────────────────────────────────

async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  const token = getToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };

  if (token) headers['Authorization'] = `Bearer ${token}`;

  const userId = getUserId();
  if (userId) headers['X-User-Id'] = userId;

  // Send role so backend endpoints that require X-User-Role don't fail
  const role = getUserRole();
  if (role) headers['X-User-Role'] = role;

  try {
    const response = await fetch(url, { ...options, headers });

    if (response.status === 401) {
      handleAuthError();
      throw new Error('Session expired. Please sign in again.');
    }

    if (response.status === 403) {
      throw new Error('You do not have permission to perform this action.');
    }

    if (response.status === 500 || response.status === 502 || response.status === 503 || response.status === 504) {
      // Service is down or has an internal error — throw a clear message, not a generic crash
      throw new Error(`Service temporarily unavailable (${response.status}). Please try again later.`);
    }

    if (!response.ok) {
      const bodyText = await response.text();
      let errorMessage: string;
      try {
        const errorJson = JSON.parse(bodyText);
        errorMessage = errorJson.message || errorJson.error || JSON.stringify(errorJson);
      } catch {
        errorMessage = bodyText || `Request failed with status ${response.status}`;
      }
      throw new Error(errorMessage);
    }

    if (response.status === 204) return {} as T;

    // Some endpoints return plain text (e.g. scoring calculate)
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      const text = await response.text();
      return text as unknown as T;
    }

    return response.json();
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error('Network error. Please check your connection and try again.');
    }
    throw error;
  }
}

// ── Auth APIs ─────────────────────────────────────────────────────────────────

export const authApi = {
  login: (email: string, password: string) =>
    fetchApi<{
      accessToken: string;
      tokenType: string;
      userId: number;
      email: string;
      fullName: string;
      role: string;
    }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  register: (data: {
    fullName?: string;
    email: string;
    password: string;
    phoneNumber?: string;
    roleName?: string;
  }) =>
    fetchApi('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  forgotPassword: (email: string) =>
    fetchApi('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  resetPassword: (token: string, newPassword: string) =>
    fetchApi('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, newPassword }),
    }),

  getMe: () => fetchApi<any>('/auth/me'),

  /** Returns users with active/accountLocked fields (enriched by backend) */
  getAllUsers: () => fetchApi<any[]>('/auth/users'),
  updateUser: (userId: string, data: any) =>
    fetchApi(`/auth/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
};

// ── Admin APIs ────────────────────────────────────────────────────────────────

export const adminApi = {
  /** GET /api/auth/users — routed via auth-service */
  getAllUsers: () => fetchApi<any[]>('/auth/users'),

  createUser: (data: {
    fullName: string;
    email: string;
    password: string;
    phoneNumber?: string;
    roleName: string;
  }) =>
    fetchApi('/auth/admin/users', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateUser: (userId: string, data: any) =>
    fetchApi(`/auth/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteUser: (userId: string) =>
    fetchApi(`/auth/admin/users/${userId}`, { method: 'DELETE' }),

  assignRole: (userId: string, roleName: string) =>
    fetchApi(`/auth/admin/users/${userId}/role`, {
      method: 'PUT',
      body: JSON.stringify({ roleName }),
    }),

  lockAccount: (userId: string) =>
    fetchApi(`/auth/admin/users/${userId}/lock`, { method: 'POST' }),

  unlockAccount: (userId: string) =>
    fetchApi(`/auth/admin/users/${userId}/unlock`, { method: 'POST' }),

  resetPassword: (userId: string, newPassword: string) =>
    fetchApi(`/auth/admin/users/${userId}/reset-password`, {
      method: 'POST',
      body: JSON.stringify({ newPassword }),
    }),
};

// ── Vendor APIs ───────────────────────────────────────────────────────────────

export const vendorApi = {
  /** Returns a PagedResponse. Use page/size params or omit for defaults (page=0, size=50). */
  getAll: (page = 0, size = 50) =>
    fetchApi<PagedResponse<any>>(`/vendors?page=${page}&size=${size}`),
  getAllList: () =>
    fetchApi<PagedResponse<any>>('/vendors?page=0&size=200').then(unwrapPage),
  getById: (id: string | number) => fetchApi<any>(`/vendors/${id}`),
  getByUserId: (userId: string | number) => fetchApi<any>(`/vendors/user/${userId}`),
  getByStatus: (status: string) => fetchApi<any[]>(`/vendors/status/${status}`),
  getCategories: () => fetchApi<any[]>('/vendors/categories'),

  register: (data: {
    companyName: string;
    contactPerson: string;
    email: string;
    categoryId: number;
    phoneNumber?: string;
    address?: string;
    taxId?: string;
  }) =>
    fetchApi('/vendors/register', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string | number, data: any) =>
    fetchApi(`/vendors/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  verify: (id: string | number) =>
    fetchApi(`/vendors/${id}/verify`, { method: 'POST' }),

  updateStatus: (id: string | number, status: string) =>
    fetchApi(`/vendors/${id}/status?status=${encodeURIComponent(status)}`, { method: 'PUT' }),

  getDocuments: (vendorId: string | number) =>
    fetchApi<any[]>(`/vendors/${vendorId}/documents`),

  uploadDocument: (vendorId: string | number, data: any) =>
    fetchApi(`/vendors/${vendorId}/documents`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  deleteDocument: (documentId: string | number) =>
    fetchApi(`/vendors/documents/${documentId}`, { method: 'DELETE' }),

  getExpiringDocuments: (date: string) =>
    fetchApi<any[]>(`/vendors/documents/expiring?date=${date}`),
};

// ── Purchase Order APIs ───────────────────────────────────────────────────────

export const poApi = {
  /** Returns a PagedResponse. Use page/size params or omit for defaults. */
  getAll: (page = 0, size = 50) =>
    fetchApi<PagedResponse<any>>(`/purchase-orders?page=${page}&size=${size}`),
  getAllList: () =>
    fetchApi<PagedResponse<any>>('/purchase-orders?page=0&size=200').then(unwrapPage),
  getById: (id: string | number) => fetchApi<any>(`/purchase-orders/${id}`),

  /**
   * Create a PO. Backend requires rfqId + vendorId + totalAmount.
   * expectedDeliveryDate must be a LocalDate string "YYYY-MM-DD".
   */
  create: (data: {
    rfqId: number;
    vendorId: number;
    totalAmount: number;
    expectedDeliveryDate?: string;
    bidId?: number;
  }) =>
    fetchApi('/purchase-orders', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  /** Update mutable fields of an existing PO */
  update: (id: string | number, data: {
    vendorId?: number;
    totalAmount?: number;
    expectedDeliveryDate?: string;
  }) =>
    fetchApi(`/purchase-orders/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  approve: (id: string | number) =>
    fetchApi(`/purchase-orders/${id}/approve`, { method: 'POST' }),

  reject: (id: string | number) =>
    fetchApi(`/purchase-orders/${id}/reject`, { method: 'POST' }),

  updateStatus: (id: string | number, status: string) =>
    fetchApi(`/purchase-orders/${id}/status?status=${encodeURIComponent(status)}`, { method: 'PUT' }),
};

// ── RFQ APIs ──────────────────────────────────────────────────────────────────

export const rfqApi = {
  /** Returns a PagedResponse. Use page/size params or omit for defaults. */
  getAll: (page = 0, size = 50) =>
    fetchApi<PagedResponse<any>>(`/rfqs?page=${page}&size=${size}`),
  getAllList: () =>
    fetchApi<PagedResponse<any>>('/rfqs?page=0&size=200').then(unwrapPage),
  getById: (id: string | number) => fetchApi<any>(`/rfqs/${id}`),
  getByStatus: (status: string) => fetchApi<any[]>(`/rfqs/status/${status}`),

  create: (data: {
    title: string;
    description?: string;
    deadline: string; // ISO string — backend accepts LocalDateTime
    estimatedValue?: number;
    categoryId?: number;
    expectedQuantity?: number;
  }) =>
    fetchApi('/rfqs', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string | number, data: any) =>
    fetchApi(`/rfqs/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  close: (id: string | number) =>
    fetchApi(`/rfqs/${id}/close`, { method: 'POST' }),
};

// ── Bid APIs ──────────────────────────────────────────────────────────────────

export const bidApi = {
  /** Response includes id, vendorName, deliveryTime, score aliases */
  getByRfq: (rfqId: string | number) => fetchApi<any[]>(`/bids/rfq/${rfqId}`),
  getByVendor: (vendorId: string | number) => fetchApi<any[]>(`/bids/vendor/${vendorId}`),
  getRanked: (rfqId: string | number) => fetchApi<any[]>(`/bids/rfq/${rfqId}/ranked`),

  submit: (data: {
    rfqId: number;
    vendorId: number;
    bidAmount: number;
    proposalText?: string;
    deliveryDays?: number;
  }) =>
    fetchApi('/bids', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  evaluate: (bidId: string | number) =>
    fetchApi(`/bids/${bidId}/evaluate`, { method: 'POST' }),

  award: (bidId: string | number) =>
    fetchApi(`/bids/${bidId}/award`, { method: 'POST' }),
};

// ── Delivery APIs ─────────────────────────────────────────────────────────────

export const deliveryApi = {
  getAll: (page = 0, size = 50) =>
    fetchApi<PagedResponse<any>>(`/deliveries?page=${page}&size=${size}`),
  getAllList: () =>
    fetchApi<PagedResponse<any>>('/deliveries?page=0&size=200').then(unwrapPage),
  getByPO: (poId: string | number) => fetchApi<any[]>(`/deliveries/po/${poId}`),

  /** Backend accepts JSON body (DeliveryRequest) */
  create: (data: {
    poId: number;
    vendorId: number;
    expectedDate?: string;
    actualDate?: string;
    quantityDelivered: number;
    issueNotes?: string;
    qualityRemarks?: string;
  }) =>
    fetchApi('/deliveries', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

// ── Invoice APIs ──────────────────────────────────────────────────────────────

export const invoiceApi = {
  /** ADMIN, OFFICER, MANAGER, AUDITOR only — returns 403 for VENDOR */
  getAll: () => fetchApi<any[]>('/invoices'),
  getByPO: (poId: string | number) => fetchApi<any[]>(`/invoices/po/${poId}`),

  /** Backend accepts JSON body (InvoiceRequest) */
  create: (data: {
    poId: number;
    invoiceAmount: number;
    vendorId: number;
  }) =>
    fetchApi('/invoices', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  validate: (id: string | number, expectedAmount: number, expectedQuantity: number) =>
    fetchApi(
      `/invoices/${id}/validate?expectedAmount=${expectedAmount}&expectedQuantity=${expectedQuantity}`,
      { method: 'POST' }
    ),

  dispute: (id: string | number, reason: string) =>
    fetchApi(`/invoices/${id}/dispute?reason=${encodeURIComponent(reason)}`, {
      method: 'POST',
    }),
};

// ── Scoring APIs ──────────────────────────────────────────────────────────────

export const scoringApi = {
  getRanking: () => fetchApi<any[]>('/scores/ranking'),
  getByVendor: (vendorId: string | number) => fetchApi<any[]>(`/scores/vendor/${vendorId}`),
  /** Returns a plain string message, not JSON */
  calculate: (vendorId: string | number) =>
    fetchApi<string>(`/scores/calculate/${vendorId}`, { method: 'POST' }),
};
// ── Analytics APIs ────────────────────────────────────────────────────────────

export const analyticsApi = {
  getDashboard: () => fetchApi<any>('/dashboard/overview'),
  getSpendReport: () => fetchApi<any>('/reports/spend'),
  getComplianceReport: () => fetchApi<any>('/reports/compliance'),

  /** userId is required by the backend */
  getActivity: (userId: string | number) =>
    fetchApi<any>(`/analytics/activity?userId=${userId}`),

  getVendorComparison: (vendorIds: (string | number)[]) =>
    fetchApi<any>(`/reports/vendor-comparison?vendorIds=${vendorIds.join(',')}`),
};

// ── Inventory APIs ────────────────────────────────────────────────────────────

export const inventoryApi = {
  getAll: (page = 0, size = 50) =>
    fetchApi<PagedResponse<any>>(`/inventory?page=${page}&size=${size}`),
  getAllList: () =>
    fetchApi<PagedResponse<any>>('/inventory?page=0&size=200').then(unwrapPage),
  getById: (id: string | number) => fetchApi<any>(`/inventory/${id}`),

  create: (data: {
    itemCode: string;
    name: string;
    description?: string;
    quantity: number;
    minStock: number;
    maxStock: number;
    unit?: string;
    location?: string;
    category?: string;
  }) =>
    fetchApi('/inventory', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string | number, data: any) =>
    fetchApi(`/inventory/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: (id: string | number) =>
    fetchApi(`/inventory/${id}`, { method: 'DELETE' }),

  adjustStock: (id: string | number, quantityChange: number) =>
    fetchApi(`/inventory/${id}/adjust`, {
      method: 'POST',
      body: JSON.stringify({ quantityChange }),
    }),

  getLowStock: () => fetchApi<any[]>('/inventory/low-stock'),
};

// ── Settings APIs ─────────────────────────────────────────────────────────────

export const settingsApi = {
  getSettings: () => fetchApi<any>('/auth/settings'),
  updateSettings: (data: any) =>
    fetchApi('/auth/settings', { method: 'PUT', body: JSON.stringify(data) }),

  getNotifications: () => fetchApi<any>('/auth/settings/notifications'),
  updateNotifications: (data: any) =>
    fetchApi('/auth/settings/notifications', { method: 'PUT', body: JSON.stringify(data) }),

  getSecurity: () => fetchApi<any>('/auth/settings/security'),
  updateSecurity: (data: any) =>
    fetchApi('/auth/settings/security', { method: 'PUT', body: JSON.stringify(data) }),
};

// ── Requisition APIs ──────────────────────────────────────────────────────────

export const requisitionApi = {
  getAll: (page = 0, size = 50) =>
    fetchApi<PagedResponse<any>>(`/procurement/requisitions?page=${page}&size=${size}`),
  getAllList: () =>
    fetchApi<PagedResponse<any>>('/procurement/requisitions?page=0&size=200').then(unwrapPage),
  getById: (id: string | number) => fetchApi<any>(`/procurement/requisitions/${id}`),

  create: (data: {
    department: string;
    justification?: string;
    estimatedBudget: number;
    items: Array<{
      itemName: string;
      description?: string;
      quantity: number;
      unit?: string;
      estimatedUnitPrice: number;
      category?: string;
    }>;
  }) =>
    fetchApi('/procurement/requisitions', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getMyRequisitions: () => fetchApi<any[]>('/procurement/requisitions/my-requisitions'),
  getByStatus: (status: string) =>
    fetchApi<any[]>(`/procurement/requisitions/status/${status}`),

  approve: (id: string | number, data: { decision: string; comments?: string }) =>
    fetchApi(`/procurement/requisitions/${id}/approve`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

// ── 3-Way Match APIs ──────────────────────────────────────────────────────────

export const threeWayMatchApi = {
  /** Backend now accepts JSON body (ThreeWayMatchRequest) */
  validate: (
    poId: number,
    deliveryId: number,
    invoiceId: number,
    poAmount: number,
    poQuantity: number
  ): Promise<{ status: string; mismatchReason?: string }> =>
    fetchApi('/threewaymatch/validate', {
      method: 'POST',
      body: JSON.stringify({ poId, deliveryId, invoiceId, poAmount, poQuantity }),
    }),

  getByPO: (poId: string | number) => fetchApi<any>(`/threewaymatch/po/${poId}`),
};

// ── Dispute APIs ──────────────────────────────────────────────────────────────

export const disputeApi = {
  raise: (data: {
    poId: number;
    deliveryId?: number;
    invoiceId?: number;
    disputeType: string;
    description: string;
  }) =>
    fetchApi('/disputes', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getAll: () => fetchApi<any[]>('/disputes'),
  getById: (id: string | number) => fetchApi<any>(`/disputes/${id}`),

  resolve: (id: string | number, data: { resolution: string }) =>
    fetchApi(`/disputes/${id}/resolve`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getByStatus: (status: string) => fetchApi<any[]>(`/disputes/status/${status}`),
};

// ── Audit Log APIs ────────────────────────────────────────────────────────────

export const auditApi = {
  getAll: () => fetchApi<any[]>('/auth/audit-logs'),
};

// ── Notification APIs ─────────────────────────────────────────────────────────

export const notificationApi = {
  getUserNotifications: (userId: string | number) =>
    fetchApi<any[]>(`/notifications/user/${userId}`),

  getUnread: (userId: string | number) =>
    fetchApi<any[]>(`/notifications/user/${userId}/unread`),

  markAsRead: (id: string | number) =>
    fetchApi(`/notifications/${id}/read`, { method: 'POST' }),

  create: (data: any) =>
    fetchApi('/notifications', { method: 'POST', body: JSON.stringify(data) }),
};
