// API client for backend integration
// Use relative /api path so requests go through Next.js rewrites to backend
const API_BASE_URL = '/api';

// Get auth token from localStorage
function getToken(): string | null {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('token');
  }
  return null;
}

// Get user ID from localStorage
function getUserId(): string | null {
  if (typeof window !== 'undefined') {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        return user.id || user.userId || null;
      } catch {
        return null;
      }
    }
  }
  return null;
}

// Handle auth errors by clearing storage and redirecting
function handleAuthError(status: number) {
  if (typeof window !== 'undefined') {
    if (status === 401) {
      // Token expired or invalid - clear auth and redirect to login
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
  }
}

// Generic fetch wrapper
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
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  // Add X-User-Id header for backend services that need it
  const userId = getUserId();
  if (userId) {
    headers['X-User-Id'] = userId;
  }
  
  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });
    
    // Handle auth errors
    if (response.status === 401) {
      handleAuthError(401);
      throw new Error('Session expired. Please sign in again.');
    }
    
    if (response.status === 403) {
      throw new Error('You do not have permission to perform this action.');
    }
    
    if (!response.ok) {
      // Read body once as text, then try to parse as JSON
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
    
    if (response.status === 204) {
      return {} as T;
    }
    
    return response.json();
  } catch (error) {
    // Re-throw network errors with better message
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error('Network error. Please check your connection and try again.');
    }
    throw error;
  }
}

// Auth APIs
export const authApi = {
  login: (email: string, password: string) =>
    fetchApi<{ accessToken: string; tokenType: string; userId: string | number; email: string; fullName: string; role: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  register: (data: { email: string; password: string; firstName?: string; lastName?: string; fullName?: string; phoneNumber?: string; roleName?: string }) =>
    fetchApi('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getMe: () => fetchApi('/auth/me'),

  // User management (Admin only)
  getAllUsers: () => fetchApi<any[]>('/auth/users'),
  updateUser: (userId: string, data: any) =>
    fetchApi(`/auth/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
};

// Settings APIs
export const settingsApi = {
  getSettings: () => fetchApi('/settings'),
  updateSettings: (data: any) =>
    fetchApi('/settings', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  getNotifications: () => fetchApi('/settings/notifications'),
  updateNotifications: (data: any) =>
    fetchApi('/settings/notifications', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  getSecurity: () => fetchApi('/settings/security'),
  updateSecurity: (data: any) =>
    fetchApi('/settings/security', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
};

// Admin APIs (Admin only endpoints)
export const adminApi = {
  // User management
  getAllUsers: () => fetchApi<any[]>('/admin/users'),
  createUser: (data: { fullName: string; email: string; password: string; phoneNumber?: string; roleName: string }) =>
    fetchApi('/admin/users', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateUser: (userId: string, data: any) =>
    fetchApi(`/admin/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deleteUser: (userId: string) =>
    fetchApi(`/admin/users/${userId}`, { method: 'DELETE' }),
  assignRole: (userId: string, roleName: string) =>
    fetchApi(`/admin/users/${userId}/role`, {
      method: 'PUT',
      body: JSON.stringify({ roleName }),
    }),
  lockAccount: (userId: string) =>
    fetchApi(`/admin/users/${userId}/lock`, { method: 'POST' }),
  unlockAccount: (userId: string) =>
    fetchApi(`/admin/users/${userId}/unlock`, { method: 'POST' }),
  resetPassword: (userId: string, newPassword: string) =>
    fetchApi(`/admin/users/${userId}/reset-password`, {
      method: 'POST',
      body: JSON.stringify({ newPassword }),
    }),
};

// Vendor APIs
export const vendorApi = {
  getAll: () => fetchApi<any[]>('/vendors'),
  getById: (id: string) => fetchApi(`/vendors/${id}`),
  getByStatus: (status: string) => fetchApi(`/vendors/status/${status}`),
  register: (data: any) =>
    fetchApi('/vendors/register', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  verify: (id: string) =>
    fetchApi(`/vendors/${id}/verify`, { method: 'POST' }),
  updateStatus: (id: string, status: string) =>
    fetchApi(`/vendors/${id}/status?status=${status}`, { method: 'PUT' }),
  // Document methods
  getDocuments: (vendorId: string) =>
    fetchApi<any[]>(`/vendors/${vendorId}/documents`),
  uploadDocument: (vendorId: string, data: any) =>
    fetchApi(`/vendors/${vendorId}/documents`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  deleteDocument: (documentId: string) =>
    fetchApi(`/vendors/documents/${documentId}`, { method: 'DELETE' }),
  getExpiringDocuments: (date: string) =>
    fetchApi<any[]>(`/vendors/documents/expiring?date=${date}`),
};

// Purchase Order APIs
export const poApi = {
  getAll: () => fetchApi<any[]>('/purchase-orders'),
  getById: (id: string) => fetchApi(`/purchase-orders/${id}`),
  create: (data: any) =>
    fetchApi('/purchase-orders', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  approve: (id: string) =>
    fetchApi(`/purchase-orders/${id}/approve`, { method: 'POST' }),
  reject: (id: string) =>
    fetchApi(`/purchase-orders/${id}/reject`, { method: 'POST' }),
  updateStatus: (id: string, status: string) =>
    fetchApi(`/purchase-orders/${id}/status?status=${status}`, { method: 'PUT' }),
};

// RFQ APIs
export const rfqApi = {
  getAll: () => fetchApi<any[]>('/rfqs'),
  getById: (id: string) => fetchApi(`/rfqs/${id}`),
  getByStatus: (status: string) => fetchApi(`/rfqs/status/${status}`),
  create: (data: any) =>
    fetchApi('/rfqs', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  close: (id: string) =>
    fetchApi(`/rfqs/${id}/close`, { method: 'POST' }),
};

// Bid APIs
export const bidApi = {
  getByRfq: (rfqId: string) => fetchApi(`/bids/rfq/${rfqId}`),
  getByVendor: (vendorId: string) => fetchApi(`/bids/vendor/${vendorId}`),
  getRanked: (rfqId: string) => fetchApi(`/bids/rfq/${rfqId}/ranked`),
  submit: (data: any) =>
    fetchApi('/bids', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  evaluate: (bidId: string) =>
    fetchApi(`/bids/${bidId}/evaluate`, { method: 'POST' }),
  award: (bidId: string) =>
    fetchApi(`/bids/${bidId}/award`, { method: 'POST' }),
};

// Delivery APIs
export const deliveryApi = {
  getByPO: (poId: string) => fetchApi(`/deliveries/po/${poId}`),
  create: (data: any) =>
    fetchApi('/deliveries', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

// Invoice APIs
export const invoiceApi = {
  getByPO: (poId: string) => fetchApi(`/invoices/po/${poId}`),
  create: (data: any) =>
    fetchApi('/invoices', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  validate: (id: string, expectedAmount: number, expectedQuantity: number) =>
    fetchApi(`/invoices/${id}/validate?expectedAmount=${expectedAmount}&expectedQuantity=${expectedQuantity}`, {
      method: 'POST',
    }),
  dispute: (id: string, reason: string) =>
    fetchApi(`/invoices/${id}/dispute?reason=${encodeURIComponent(reason)}`, {
      method: 'POST',
    }),
};

// Scoring APIs
export const scoringApi = {
  getRanking: () => fetchApi('/scores/ranking'),
  getByVendor: (vendorId: string) => fetchApi(`/scores/vendor/${vendorId}`),
  calculate: (vendorId: string) =>
    fetchApi(`/scores/calculate/${vendorId}`, { method: 'POST' }),
};

// Analytics APIs
export const analyticsApi = {
  getDashboard: () => fetchApi('/dashboard/overview'),
  getSpendReport: () => fetchApi('/reports/spend'),
  getComplianceReport: () => fetchApi('/reports/compliance'),
  getActivity: () => fetchApi<any[]>('/analytics/activity'),
  getVendorComparison: (vendorIds: string[]) =>
    fetchApi(`/reports/vendor-comparison?vendorIds=${vendorIds.join(',')}`),
};

// Inventory APIs
export const inventoryApi = {
  getAll: () => fetchApi<any[]>('/inventory'),
  getById: (id: string) => fetchApi(`/inventory/${id}`),
  create: (data: any) =>
    fetchApi('/inventory', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  update: (id: string, data: any) =>
    fetchApi(`/inventory/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  delete: (id: string) =>
    fetchApi(`/inventory/${id}`, { method: 'DELETE' }),
  adjustStock: (id: string, quantityChange: number) =>
    fetchApi(`/inventory/${id}/adjust`, {
      method: 'POST',
      body: JSON.stringify({ quantityChange }),
    }),
  getLowStock: () => fetchApi<any[]>('/inventory/low-stock'),
};

// Requisition APIs
export const requisitionApi = {
  getAll: () => fetchApi<any[]>('/procurement/requisitions'),
  getById: (id: string) => fetchApi<any>(`/procurement/requisitions/${id}`),
  create: (data: any) =>
    fetchApi('/procurement/requisitions', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getMyRequisitions: () => fetchApi<any[]>('/procurement/requisitions/my-requisitions'),
  getByStatus: (status: string) => fetchApi<any[]>(`/procurement/requisitions/status/${status}`),
  approve: (id: string, data: any) =>
    fetchApi(`/procurement/requisitions/${id}/approve`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

// 3-Way Match APIs
export const threeWayMatchApi = {
  validate: (poId: string, deliveryId: string, invoiceId: string, poAmount: number, poQuantity: number): Promise<{ status: string; mismatchReason?: string }> =>
    fetchApi('/threewaymatch/validate', {
      method: 'POST',
      body: JSON.stringify({ poId, deliveryId, invoiceId, poAmount, poQuantity }),
    }),
  getByPO: (poId: string) => fetchApi<any>(`/threewaymatch/po/${poId}`),
};

// Dispute APIs
export const disputeApi = {
  raise: (data: any) =>
    fetchApi('/disputes', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getAll: () => fetchApi<any[]>('/disputes'),
  getById: (id: string) => fetchApi<any>(`/disputes/${id}`),
  resolve: (id: string, data: any) =>
    fetchApi(`/disputes/${id}/resolve`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getByStatus: (status: string) => fetchApi<any[]>(`/disputes/status/${status}`),
};

// Notification APIs
export const notificationApi = {
  getUserNotifications: (userId: string) => fetchApi<any[]>(`/notifications/user/${userId}`),
  getUnread: (userId: string) => fetchApi<any[]>(`/notifications/user/${userId}/unread`),
  markAsRead: (id: string) =>
    fetchApi(`/notifications/${id}/read`, {
      method: 'POST',
    }),
  create: (data: any) =>
    fetchApi('/notifications', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

// Types
export interface Vendor {
  id: string;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  status: string;
  createdAt: string;
}
