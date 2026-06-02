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

export interface ListQueryParams {
  page?: number;
  size?: number;
  search?: string;
  status?: string;
  statuses?: string[];
  vendorIds?: number[];
  vendorId?: number;
  categoryId?: number;
  role?: string;
  accountStatus?: string;
  tenantId?: number;
  sort?: string;
}

function buildListQuery(params: ListQueryParams = {}): string {
  const q = new URLSearchParams();
  q.set('page', String(params.page ?? 0));
  q.set('size', String(params.size ?? 50));
  if (params.search?.trim()) q.set('search', params.search.trim());
  if (params.status && params.status !== 'ALL') q.set('status', params.status);
  if (params.statuses?.length) q.set('statuses', params.statuses.join(','));
  if (params.vendorIds?.length) {
    params.vendorIds.forEach((id) => q.append('vendorIds', String(id)));
  }
  if (params.vendorId != null) q.set('vendorId', String(params.vendorId));
  if (params.categoryId != null) q.set('categoryId', String(params.categoryId));
  if (params.role && params.role !== 'ALL') q.set('role', params.role);
  if (params.accountStatus && params.accountStatus !== 'ALL') q.set('accountStatus', params.accountStatus);
  if (params.tenantId != null) q.set('tenantId', String(params.tenantId));
  if (params.sort) q.set('sort', params.sort);
  return q.toString();
}

/** Maps UI PO status filters to backend query params. */
export function poStatusQuery(statusFilter: string): Pick<ListQueryParams, 'status' | 'statuses'> {
  if (!statusFilter || statusFilter === 'ALL') return {};
  if (statusFilter === 'Shipped') return { statuses: ['Shipped', 'In Transit'] };
  if (statusFilter === 'Pending Approval') return { statuses: ['Pending Approval', 'Draft'] };
  return { status: statusFilter };
}

/** Maps procurement tab names to backend status filters. */
export function poTabQuery(tab: string): Pick<ListQueryParams, 'status' | 'statuses'> {
  switch (tab) {
    case 'pending':
      return { statuses: ['Pending Approval', 'Draft'] };
    case 'approved':
      return { status: 'Approved' };
    case 'rejected':
      return { status: 'Rejected' };
    default:
      return {};
  }
}

/** Maps delivery UI status values to backend deliveryStatus values. */
export function deliveryStatusQuery(statusFilter: string): Pick<ListQueryParams, 'status' | 'statuses'> {
  if (!statusFilter || statusFilter === 'ALL') return {};
  switch (statusFilter.toUpperCase()) {
    case 'IN_TRANSIT':
      return { status: 'In Transit' };
    case 'SHIPPED':
      return { status: 'Shipped' };
    case 'DELIVERED':
      return { status: 'Delivered' };
    case 'PENDING':
      return { status: 'Pending' };
    case 'CANCELLED':
      return { status: 'Cancelled' };
    default:
      return { status: statusFilter };
  }
}

/** Maps invoice UI status filters to backend status values. */
export function invoiceStatusQuery(statusFilter: string): Pick<ListQueryParams, 'status'> {
  if (!statusFilter || statusFilter === 'ALL') return {};
  const map: Record<string, string> = {
    PENDING: 'Pending',
    APPROVED: 'Approved',
    PAID: 'Paid',
    VALIDATED: 'Validated',
    DISPUTED: 'Disputed',
    REJECTED: 'Rejected',
  };
  return { status: map[statusFilter.toUpperCase()] || statusFilter };
}

/** Resolve vendor IDs whose names match a search term (for PO vendor-name search). */
export function resolveVendorIdsFromSearch(
  search: string,
  vendorMap: Record<string, string>
): number[] {
  const q = search.trim().toLowerCase();
  if (!q) return [];
  return Object.entries(vendorMap)
    .filter(([, name]) => name.toLowerCase().includes(q))
    .map(([id]) => Number(id))
    .filter((id) => !Number.isNaN(id));
}

// ── Auth state helpers ────────────────────────────────────────────────────────

function getStoredState(): { token: string | null; user: any | null; tenantId: number | null } {
  if (typeof window === 'undefined') return { token: null, user: null, tenantId: null };
  try {
    const stored = sessionStorage.getItem('auth-storage');
    if (!stored) return { token: null, user: null, tenantId: null };
    const parsed = JSON.parse(stored);
    return {
      token: parsed?.state?.token ?? null,
      user: parsed?.state?.user ?? null,
      tenantId: parsed?.state?.tenantId ?? null,
    };
  } catch {
    return { token: null, user: null, tenantId: null };
  }
}

function getToken(): string | null {
  const token = getStoredState().token;
  if (!token) return null;

  const parts = token.split('.');
  if (parts.length !== 3 || parts.some((p) => !p)) {
    console.error('Invalid JWT token format - clearing authentication');
    handleAuthError();
    return null;
  }

  // Check if token is expired
  try {
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      console.warn('JWT token expired - clearing authentication');
      handleAuthError();
      return null;
    }
  } catch {
    // If we can't decode the payload, let the backend validate
  }

  return token;
}

// ── Auth error handler ────────────────────────────────────────────────────────

function handleAuthError() {
  if (typeof window !== 'undefined') {
    sessionStorage.removeItem('auth-storage');
    sessionStorage.removeItem('sessionActive');
    window.location.href = '/login';
  }
}

// ── Generic fetch wrapper ─────────────────────────────────────────────────────

const FETCH_TIMEOUT_MS = 30_000; // 30 seconds

async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  const token = getToken();
  const { tenantId } = getStoredState();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };

  if (token) headers['Authorization'] = `Bearer ${token}`;

  // Forward tenantId so the API Gateway can apply tenant-level rate limiting
  // and as a fallback for services that read X-Tenant-ID from headers.
  if (tenantId) headers['X-Tenant-ID'] = String(tenantId);

  // NOTE: X-User-Id is intentionally NOT sent here.
  // The API Gateway extracts userId from the validated JWT and injects
  // X-Authenticated-User-Id as a trusted header. Any client-supplied
  // X-User-Id is stripped by the gateway to prevent spoofing.

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, { ...options, headers, signal: controller.signal });

    if (response.status === 401) {
      handleAuthError();
      throw new Error('Session expired. Please sign in again.');
    }

    if (response.status === 403) {
      const body = await response.text().catch(() => '');
      let message = 'You do not have permission to perform this action.';
      try {
        const json = JSON.parse(body);
        if (json.message) message = json.message;
      } catch { /* keep default */ }
      console.warn('403 Forbidden — response:', body);
      throw new Error(message);
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
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('Request timed out. The server took too long to respond.');
    }
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error('Network error. Please check your connection and try again.');
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

// ── Auth APIs ─────────────────────────────────────────────────────────────────

export const authApi = {
  login: (email: string, password: string, tenantDomain?: string) =>
    fetchApi<{
      accessToken: string;
      tokenType: string;
      userId: number;
      email: string;
      fullName: string;
      role: string;
      procurementRole?: string;
      supplierRole?: string | null;
      tenantId: number;
      tenantName: string;
      tenantDomain: string;
      organizationType?: string;
      operatingContext?: string;
      availableContexts?: string[];
      mustChangePassword: boolean;
    }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password, ...(tenantDomain && { tenantDomain }) }),
    }),

  register: (data: {
    fullName?: string;
    email: string;
    password: string;
    phoneNumber?: string;
    roleName: string;
    tenantDomain?: string;
    companyName?: string;
  }) =>
    fetchApi('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  inviteTeamMember: (data: { fullName: string; email: string; roleName: string; phoneNumber?: string }) =>
    fetchApi<any>('/auth/invite', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getUsers: () =>
    fetchApi<PagedResponse<any>>('/auth/users?page=0&size=500&sort=name-asc').then(unwrapPage),

  getPendingVendorApprovals: () => fetchApi<any[]>('/auth/vendor-approvals'),

  approveVendor: (userId: number) =>
    fetchApi(`/auth/vendor-approvals/${userId}/approve`, { method: 'POST' }),

  rejectVendor: (userId: number) =>
    fetchApi(`/auth/vendor-approvals/${userId}/reject`, { method: 'POST' }),

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

  changePassword: (currentPassword: string, newPassword: string) =>
    fetchApi<{ message: string }>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    }),

  getMyTenant: () => fetchApi<any>('/auth/my-tenant'),

  updateMyTenant: (name: string) =>
    fetchApi<any>('/auth/my-tenant', {
      method: 'PUT',
      body: JSON.stringify({ name }),
    }),

  logout: () => fetchApi<void>('/auth/logout', { method: 'POST' }),

  getMyTenants: () => fetchApi<{ tenantId: number; name: string; domain: string; status: string }[]>('/auth/my-tenants'),

  switchTenant: (tenantDomain: string) =>
    fetchApi<{
      accessToken: string;
      tokenType: string;
      userId: number;
      email: string;
      fullName: string;
      role: string;
      procurementRole?: string;
      supplierRole?: string | null;
      tenantId: number;
      tenantName: string;
      tenantDomain: string;
      organizationType?: string;
      operatingContext?: string;
      availableContexts?: string[];
    }>('/auth/switch-tenant', {
      method: 'POST',
      body: JSON.stringify({ tenantDomain }),
    }),

  switchContext: (context: 'PROCUREMENT' | 'SALES') =>
    fetchApi<{
      accessToken: string;
      tokenType: string;
      userId: number;
      email: string;
      fullName: string;
      role: string;
      procurementRole?: string;
      supplierRole?: string | null;
      tenantId: number;
      tenantName: string;
      tenantDomain: string;
      organizationType?: string;
      operatingContext?: string;
      availableContexts?: string[];
    }>('/auth/switch-context', {
      method: 'POST',
      body: JSON.stringify({ context }),
    }),

  /** Paginated user list with optional server-side filters (tenant-scoped). */
  getAllUsers: (params: ListQueryParams = {}) =>
    fetchApi<PagedResponse<any>>(`/auth/users?${buildListQuery(params)}`),
  getAllUsersList: () =>
    fetchApi<PagedResponse<any>>('/auth/users?page=0&size=500&sort=name-asc').then(unwrapPage),
  getUserStats: () => fetchApi<{ totalUsers: number; activeUsers: number; lockedUsers: number; tenantCount: number }>('/auth/users/stats'),
  updateUser: (userId: string, data: any) =>
    fetchApi(`/auth/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
};

// ── Admin APIs ────────────────────────────────────────────────────────────────

export const adminApi = {
  /** GET /api/auth/users — paginated with optional filters */
  getAllUsers: (params: ListQueryParams = {}) =>
    fetchApi<PagedResponse<any>>(`/auth/users?${buildListQuery(params)}`),
  getAllUsersList: () =>
    fetchApi<PagedResponse<any>>('/auth/users?page=0&size=500&sort=name-asc').then(unwrapPage),

  createUser: (data: {
    fullName: string;
    email: string;
    password: string;
    phoneNumber?: string;
    roleName: string;
    supplierRoleName?: string;
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
    fetchApi(`/admin/users/${userId}`, { method: 'DELETE' }),

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
  /** Returns a PagedResponse with optional server-side search/status filters. */
  getAll: (params: ListQueryParams = {}) =>
    fetchApi<PagedResponse<any>>(`/vendors?${buildListQuery(params)}`),
  getAllList: () =>
    fetchApi<PagedResponse<any>>('/vendors?page=0&size=200').then(unwrapPage),
  getById: (id: string | number) => fetchApi<any>(`/vendors/${id}`),
  getByUserId: (userId: string | number) => fetchApi<any>(`/vendors/user/${userId}`),
  getByStatus: (status: string) => fetchApi<any[]>(`/vendors/status/${status}`),
  getCategories: () => fetchApi<any[]>('/vendors/categories'),

  /** Creates a stub vendor profile for the currently logged-in VENDOR user if one doesn't exist. */
  initProfile: (data?: { companyName?: string; email?: string }) =>
    fetchApi<any>('/vendors/init-profile', {
      method: 'POST',
      body: JSON.stringify(data || {}),
    }),

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
    }).then((r) => { _vendorCache = null; _vendorCachePromise = null; return r; }),

  verify: (id: string | number) =>
    fetchApi(`/vendors/${id}/verify`, { method: 'POST' })
      .then((r) => { _vendorCache = null; _vendorCachePromise = null; return r; }),

  updateStatus: (id: string | number, status: string) =>
    fetchApi(`/vendors/${id}/status?status=${encodeURIComponent(status)}`, { method: 'PUT' })
      .then((r) => { _vendorCache = null; _vendorCachePromise = null; return r; }),

  getDocuments: (vendorId: string | number) =>
    fetchApi<any[]>(`/vendors/${vendorId}/documents`),

  uploadDocument: async (vendorId: string | number, formData: FormData) => {
    const token = getToken();
    const { tenantId } = getStoredState();
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (tenantId) headers['X-Tenant-ID'] = String(tenantId);
    const response = await fetch(`${API_BASE_URL}/vendors/${vendorId}/documents`, {
      method: 'POST',
      headers,
      body: formData,
    });
    if (!response.ok) {
      const text = await response.text().catch(() => 'Upload failed');
      throw new Error(text || `Upload failed (${response.status})`);
    }
    return response.json();
  },

  downloadDocumentUrl: (documentId: string | number) =>
    `${API_BASE_URL}/vendors/documents/${documentId}/file`,

  deleteDocument: (documentId: string | number) =>
    fetchApi(`/vendors/documents/${documentId}`, { method: 'DELETE' }),

  getExpiringDocuments: (date: string) =>
    fetchApi<any[]>(`/vendors/documents/expiring?date=${date}`),
};

// ── Purchase Order APIs ───────────────────────────────────────────────────────

export const poApi = {
  /** Returns a PagedResponse with optional server-side filters. */
  getAll: (params: ListQueryParams = {}) =>
    fetchApi<PagedResponse<any>>(`/purchase-orders?${buildListQuery(params)}`),
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

  /** Update mutable fields of an existing PO. rfqId is required by the backend (@NotNull). */
  update: (id: string | number, data: {
    rfqId: number;
    vendorId: number;
    totalAmount: number;
    expectedDeliveryDate?: string;
    bidId?: number;
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
  /** Returns a PagedResponse with optional server-side filters. */
  getAll: (params: ListQueryParams = {}) =>
    fetchApi<PagedResponse<any>>(`/rfqs?${buildListQuery(params)}`),
  getAllList: () =>
    fetchApi<PagedResponse<any>>('/rfqs?page=0&size=200').then(unwrapPage),
  getById: (id: string | number) => fetchApi<any>(`/rfqs/${id}`),
  getByStatus: (status: string) => fetchApi<any[]>(`/rfqs/status/${status}`),
  /** Winning bid for an Awarded RFQ — used when creating a PO */
  getWinningBid: (rfqId: string | number) => fetchApi<any>(`/rfqs/${rfqId}/winning-bid`),

  create: (data: {
    title: string;
    description?: string;
    deadline: string;
    estimatedValue?: number;
    categoryId?: number;
    expectedQuantity?: number;
    requisitionId?: number;
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

  cancel: (id: string | number) =>
    fetchApi(`/rfqs/${id}/cancel`, { method: 'POST' }),
};

// ── Bid APIs ──────────────────────────────────────────────────────────────────

export const bidApi = {
  /** Response includes id, companyName, deliveryTime, score aliases */
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

  /** Evaluates all submitted bids for an RFQ in one call */
  evaluateAll: (rfqId: string | number) =>
    fetchApi<any[]>(`/bids/rfq/${rfqId}/evaluate-all`, { method: 'POST' }),
};

// ── Delivery APIs ─────────────────────────────────────────────────────────────

export const deliveryApi = {
  getAll: (params: ListQueryParams = {}) =>
    fetchApi<PagedResponse<any>>(`/deliveries?${buildListQuery(params)}`),
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
    quantityOrdered?: number;
    qualityRating: string;
    qualityIssueTypes?: string;
    issueNotes?: string;
    qualityRemarks?: string;
  }) =>
    fetchApi('/deliveries', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateStatus: (deliveryId: string | number, status: string) =>
    fetchApi(`/deliveries/${deliveryId}/status?status=${encodeURIComponent(status)}`, {
      method: 'PUT',
    }),
};

// ── Invoice APIs ──────────────────────────────────────────────────────────────

export const invoiceApi = {
  /** Paginated list with server-side search/status filters. */
  getAll: (params: ListQueryParams = {}) =>
    fetchApi<PagedResponse<any>>(`/invoices?${buildListQuery(params)}`),
  getByPO: (poId: string | number) => fetchApi<any[]>(`/invoices/po/${poId}`),
  /** Vendor-specific endpoint — avoids N+1 of fetching per PO */
  getByVendor: (vendorId: string | number) => fetchApi<any[]>(`/invoices/vendor/${vendorId}`),

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

  markPaid: (id: string | number) =>
    fetchApi(`/invoices/${id}/mark-paid`, { method: 'POST' }),
};

// ── Scoring APIs ──────────────────────────────────────────────────────────────

export const scoringApi = {
  getRanking: () => fetchApi<any[]>('/scores/ranking'),
  getByVendor: (vendorId: string | number) => fetchApi<any[]>(`/scores/vendor/${vendorId}`),
  /** Returns individual KPI breakdown + overall score + risk level */
  getPerformance: (vendorId: string | number) => fetchApi<any>(`/scores/vendor/${vendorId}/performance`),
  /** Triggers recalculation and returns the updated score */
  calculate: (vendorId: string | number) =>
    fetchApi<{ message: string; vendorId: number; overallScore?: number; riskLevel?: string }>(
      `/scores/calculate/${vendorId}`, { method: 'POST' }
    ),

  /** Recalculates scores for all vendors with prior delivery data */
  recalculateAll: () =>
    fetchApi<{ message: string; vendorsProcessed: number }>(
      `/scores/recalculate-all`, { method: 'POST' }
    ),
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

export type InventoryStockStatusFilter =
  | 'ALL'
  | 'IN_STOCK'
  | 'LOW'
  | 'OUT'
  | 'OVER_MAX'
  | 'NEEDS_ATTENTION';

export type InventorySortOption =
  | 'name-asc'
  | 'name-desc'
  | 'qty-asc'
  | 'qty-desc'
  | 'sku-asc'
  | 'updated-desc';

export interface InventoryQueryParams {
  page?: number;
  size?: number;
  search?: string;
  category?: string;
  location?: string;
  stockStatus?: InventoryStockStatusFilter;
  sort?: InventorySortOption;
}

export interface InventoryStats {
  productCount: number;
  totalUnits: number;
  inStock: number;
  lowStock: number;
  outOfStock: number;
  overMax: number;
}

function buildInventoryQuery(params: InventoryQueryParams = {}): string {
  const q = new URLSearchParams();
  q.set('page', String(params.page ?? 0));
  q.set('size', String(params.size ?? 50));
  if (params.search?.trim()) q.set('search', params.search.trim());
  if (params.category && params.category !== 'ALL') q.set('category', params.category);
  if (params.location && params.location !== 'ALL') q.set('location', params.location);
  if (params.stockStatus && params.stockStatus !== 'ALL') q.set('stockStatus', params.stockStatus);
  if (params.sort) q.set('sort', params.sort);
  return q.toString();
}

export const inventoryApi = {
  getAll: (params: InventoryQueryParams = {}) =>
    fetchApi<PagedResponse<any>>(`/inventory?${buildInventoryQuery(params)}`),
  getAllList: () =>
    fetchApi<PagedResponse<any>>('/inventory?page=0&size=500&sort=name-asc').then(unwrapPage),
  getStats: () => fetchApi<InventoryStats>('/inventory/stats'),
  getFilterOptions: () =>
    fetchApi<{ categories: string[]; locations: string[] }>('/inventory/filter-options'),
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
  getAll: (params: ListQueryParams = {}) =>
    fetchApi<PagedResponse<any>>(`/procurement/requisitions?${buildListQuery(params)}`),
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

  submit: (id: string | number) =>
    fetchApi(`/procurement/requisitions/${id}/submit`, { method: 'POST' }),

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

  getAll: () =>
    fetchApi<PagedResponse<any> | any[]>('/disputes?page=0&size=200').then(unwrapPage),
  getById: (id: string | number) => fetchApi<any>(`/disputes/${id}`),

  resolve: (id: string | number, data: { resolution: string; outcome: "APPROVE_INVOICE" | "REJECT_INVOICE" }) =>
    fetchApi(`/disputes/${id}/resolve`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getByStatus: (status: string) => fetchApi<any[]>(`/disputes/status/${status}`),
};

// ── Vendor name lookup cache ──────────────────────────────────────────────────

let _vendorCache: Map<string, string> | null = null;
let _vendorCachePromise: Promise<Map<string, string>> | null = null;

/** Call after any vendor create/update/status change to force a fresh fetch on next use. */
export function invalidateVendorCache() {
  _vendorCache = null;
  _vendorCachePromise = null;
}

/** Returns a Map<vendorId, companyName> fetched once per page load.
 * Subsequent calls return the cached map immediately.
 */
export async function getCompanyNameMap(): Promise<Map<string, string>> {
  if (_vendorCache) return _vendorCache;
  if (_vendorCachePromise) return _vendorCachePromise;

  _vendorCachePromise = vendorApi.getAllList()
    .then((vendors: any[]) => {
      const map = new Map<string, string>();
      vendors.forEach((v: any) => {
        const id = String(v.vendorId || v.id || '');
        const name = v.companyName || v.name || '';
        if (id && name) map.set(id, name);
      });
      if (map.size > 0) _vendorCache = map;
      else _vendorCachePromise = null;
      return map;
    })
    .catch(() => {
      _vendorCachePromise = null; // allow retry on next call
      return new Map<string, string>();
    });

  return _vendorCachePromise;
}

// ── Category name lookup cache ────────────────────────────────────────────────

let _categoryCache: Map<string, string> | null = null;
let _categoryCachePromise: Promise<Map<string, string>> | null = null;

/**
 * Returns a Map<categoryId, categoryName> fetched once per page load.
 * Used to resolve category IDs to human-readable names on the frontend.
 */
export async function getCategoryNameMap(): Promise<Map<string, string>> {
  if (_categoryCache) return _categoryCache;
  if (_categoryCachePromise) return _categoryCachePromise;

  _categoryCachePromise = vendorApi.getCategories()
    .then((categories: any[]) => {
      const map = new Map<string, string>();
      categories.forEach((c: any) => {
        const id = String(c.categoryId || c.id || '');
        const name = c.categoryName || c.name || '';
        if (id && name) map.set(id, name);
      });
      if (map.size > 0) _categoryCache = map;
      else _categoryCachePromise = null;
      return map;
    })
    .catch(() => {
      _categoryCachePromise = null;
      return new Map<string, string>();
    });

  return _categoryCachePromise;
}

/** Resolves a vendor name from the cache. Falls back to the provided fallback string. */
export function resolvecompanyName(
  vendorId: string | number | undefined | null,
  fallback = 'Unknown vendor'
): string {
  if (!vendorId) return '—';
  const id = String(vendorId);
  return _vendorCache?.get(id) ?? fallback;
}

/** Alias kept for backward compatibility — prefer getCompanyNameMap for new code. */
export const getVendorNameMap = getCompanyNameMap;

// ── User name lookup cache ────────────────────────────────────────────────────

let _userCache: Map<string, string> | null = null;
let _userCachePromise: Promise<Map<string, string>> | null = null;

export function invalidateUserCache() {
  _userCache = null;
  _userCachePromise = null;
}

/** Returns a Map<userId, displayName> (fullName or email). */
export async function getUserNameMap(): Promise<Map<string, string>> {
  if (_userCache) return _userCache;
  if (_userCachePromise) return _userCachePromise;

  _userCachePromise = authApi.getAllUsersList()
    .then((users: any[]) => {
      const map = new Map<string, string>();
      (users ?? []).forEach((u: any) => {
        const id = String(u.userId || u.id || '');
        const name = u.fullName || u.email || '';
        if (id && name) map.set(id, name);
      });
      if (map.size > 0) _userCache = map;
      else _userCachePromise = null;
      return map;
    })
    .catch(() => {
      _userCachePromise = null;
      return new Map<string, string>();
    });

  return _userCachePromise;
}

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

// ── Super Admin APIs ──────────────────────────────────────────────────────────

export interface TenantResponse {
  tenantId: number;
  name: string;
  domain: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'INACTIVE';
  subscriptionPlan: 'BASIC' | 'PROFESSIONAL' | 'ENTERPRISE';
  settings?: Record<string, any>;
  createdAt?: string;
  updatedAt?: string;
  userCount: number;
}

export interface TenantRequest {
  name: string;
  domain: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'INACTIVE';
  subscriptionPlan: 'BASIC' | 'PROFESSIONAL' | 'ENTERPRISE';
  settings?: Record<string, any>;
}

export interface SystemOverview {
  totalTenants: number;
  activeTenants: number;
  suspendedTenants: number;
  totalUsers: number;
}

export interface SuperAdminUser {
  userId: number;
  fullName: string;
  email: string;
  phoneNumber?: string;
  roleName: string;
  active: boolean;
  accountLocked: boolean;
  lastLogin?: string;
  registrationDate?: string;
  tenantId?: number;
  tenantName?: string;
}

export interface TenantStats {
  totalTenants: number;
  activeTenants: number;
  suspendedTenants: number;
  totalUsers: number;
}

export interface UserStats {
  totalUsers: number;
  activeUsers: number;
  lockedUsers: number;
  tenantCount: number;
}

export const superAdminApi = {
  // Tenants
  getAllTenants: (params: ListQueryParams = {}) =>
    fetchApi<PagedResponse<TenantResponse>>(`/super-admin/tenants?${buildListQuery(params)}`),
  getAllTenantsList: () =>
    fetchApi<PagedResponse<TenantResponse>>('/super-admin/tenants?page=0&size=500&sort=name-asc').then(unwrapPage),
  getTenantStats: () => fetchApi<TenantStats>('/super-admin/tenants/stats'),
  createTenant: (data: TenantRequest) =>
    fetchApi<TenantResponse>('/super-admin/tenants', { method: 'POST', body: JSON.stringify(data) }),
  updateTenant: (id: number, data: TenantRequest) =>
    fetchApi<TenantResponse>(`/super-admin/tenants/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  suspendTenant: (id: number) =>
    fetchApi<TenantResponse>(`/super-admin/tenants/${id}/suspend`, { method: 'POST' }),
  activateTenant: (id: number) =>
    fetchApi<TenantResponse>(`/super-admin/tenants/${id}/activate`, { method: 'POST' }),
  deleteTenant: (id: number) =>
    fetchApi<void>(`/super-admin/tenants/${id}`, { method: 'DELETE' }),
  // Cross-tenant users
  getAllUsers: (params: ListQueryParams = {}) =>
    fetchApi<PagedResponse<SuperAdminUser>>(`/super-admin/users?${buildListQuery(params)}`),
  getAllUsersList: () =>
    fetchApi<PagedResponse<SuperAdminUser>>('/super-admin/users?page=0&size=500&sort=name-asc').then(unwrapPage),
  getUserStats: () => fetchApi<UserStats>('/super-admin/users/stats'),
  createUser: (data: {
    fullName: string; email: string; password: string;
    phoneNumber?: string; roleName: string; supplierRoleName?: string; tenantId: number;
  }) => fetchApi('/super-admin/users', { method: 'POST', body: JSON.stringify(data) }),
  assignRole: (userId: number, roleName: string) =>
    fetchApi(`/super-admin/users/${userId}/role`, { method: 'PUT', body: JSON.stringify({ roleName }) }),
  lockUser: (userId: number) =>
    fetchApi(`/super-admin/users/${userId}/lock`, { method: 'POST' }),
  unlockUser: (userId: number) =>
    fetchApi(`/super-admin/users/${userId}/unlock`, { method: 'POST' }),
  resetPassword: (userId: number, newPassword: string) =>
    fetchApi(`/super-admin/users/${userId}/reset-password`, { method: 'POST', body: JSON.stringify({ newPassword }) }),
  deleteUser: (userId: number) =>
    fetchApi<void>(`/super-admin/users/${userId}`, { method: 'DELETE' }),
  // Overview
  getOverview: () => fetchApi<SystemOverview>('/super-admin/overview'),
};
