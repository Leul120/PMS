# Frontend Architecture — Next.js, State Management, and the API Client

> **Who should read this:** Frontend developers joining the project, or backend developers who need to understand how the UI consumes the API.

---

## Technology Choices

| Technology | Version | Why |
|---|---|---|
| **Next.js** | 14.2.3 | React framework with App Router, server components, and file-based routing |
| **TypeScript** | 5.x | Type safety catches API contract mismatches at compile time, not runtime |
| **Tailwind CSS** | 3.x | Utility-first CSS — fast to write, consistent spacing/colour tokens |
| **shadcn/ui** | — | Headless Radix UI components with Tailwind styling — accessible, unstyled primitives |
| **Zustand** | — | Minimal state management for auth; no boilerplate like Redux |
| **React Hook Form** | — | Form state management with Zod validation schemas |
| **Recharts** | — | Composable chart library for analytics dashboards |
| **Axios** | — | HTTP client with interceptors for auth headers and error handling |

**Why Next.js App Router over Pages Router or a pure React SPA?**

The App Router (Next.js 13+) enables:
- **Server Components:** Components that run only on the server, with no JavaScript sent to the browser. Used for static layouts.
- **File-based routing:** `app/vendors/page.tsx` → `/vendors` route, no router configuration.
- **Built-in layout nesting:** `app/layout.tsx` wraps everything; `app/(dashboard)/layout.tsx` wraps all dashboard pages.

For this project, most pages are client-side rendered (they need auth state and dynamic data), but the App Router's layout system provides clean code organisation.

---

## Project Structure

```
frontend/
├── app/                          ← Next.js App Router
│   ├── layout.tsx               ← Root layout (theme, error boundary, session warning)
│   ├── page.tsx                 ← Landing/redirect page
│   ├── login/page.tsx
│   ├── register/page.tsx
│   ├── (dashboard)/             ← Route group (shares dashboard layout)
│   │   ├── layout.tsx          ← Sidebar + header (requires auth)
│   │   ├── vendors/page.tsx
│   │   ├── rfq/page.tsx
│   │   ├── procurement/page.tsx
│   │   ├── orders/page.tsx
│   │   ├── deliveries/page.tsx
│   │   ├── invoices/page.tsx
│   │   ├── inventory/page.tsx
│   │   ├── scoring/page.tsx
│   │   ├── analytics/page.tsx
│   │   ├── notifications/page.tsx
│   │   ├── settings/page.tsx
│   │   ├── profile/page.tsx
│   │   └── admin/
│   │       ├── users/page.tsx
│   │       ├── audit/page.tsx
│   │       └── super/page.tsx   ← SUPER_ADMIN only
├── components/
│   ├── ui/                      ← shadcn/ui components (button, dialog, table, etc.)
│   ├── protected-route.tsx
│   ├── require-role.tsx
│   ├── session-expiry-warning.tsx
│   ├── error-boundary.tsx
│   ├── header.tsx               ← Top navigation (tenant switcher here)
│   ├── sidebar.tsx              ← Left navigation (filtered by role)
│   └── [feature]-dialog.tsx    ← Feature-specific modals (vendor-dialog, rfq-dialog, etc.)
├── lib/
│   ├── api.ts                   ← All backend API calls (923 lines)
│   └── auth-store.ts            ← Zustand auth state (239 lines)
└── public/
```

---

## Authentication State: Zustand Store

**File:** `lib/auth-store.ts`

Zustand is a small state management library. Unlike Redux, there's no action/reducer boilerplate — just a store with state and methods:

```typescript
interface AuthState {
  user: User | null;
  token: string | null;
  tenantId: string | null;
  tenantName: string | null;
  tenantDomain: string | null;
  isAuthenticated: boolean;

  setAuth: (user: User, token: string, tenant?: TenantInfo) => void;
  logout: () => void;
  hasRole: (roles: UserRole[]) => boolean;
  hasPermission: (permission: string) => boolean;
}

const useAuthStore = create<AuthState>()(
  persist(                         // persist to localStorage automatically
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,

      setAuth: (user, token, tenant) => set({
        user, token,
        tenantId: tenant?.tenantId ?? user.tenantId,
        tenantName: tenant?.tenantName ?? user.tenantName,
        isAuthenticated: true
      }),

      logout: () => set({ user: null, token: null, isAuthenticated: false }),

      hasRole: (roles) => {
        const user = get().user;
        return user ? roles.includes(user.role) : false;
      },

      hasPermission: (permission) => {
        const user = get().user;
        if (!user) return false;
        const permissions = ROLE_PERMISSIONS[user.role] ?? [];
        return permissions.includes(permission);
      }
    }),
    {
      name: "auth-storage",        // localStorage key
      onRehydrateStorage: () => (state) => {
        // On app load: validate stored JWT hasn't expired
        if (state?.token) {
          try {
            const payload = JSON.parse(atob(state.token.split('.')[1]));
            if (Date.now() / 1000 > payload.exp) {
              state.logout();   // expired — clear storage, redirect to login
            }
          } catch {
            state.logout();    // malformed token
          }
        }
      }
    }
  )
);
```

**Why Zustand over React Context?**
React Context causes every component that consumes the context to re-render when any part of the context changes. With a large auth object, this could cause unnecessary re-renders across the app. Zustand uses shallow comparison and only re-renders components that subscribed to the specific piece of state that changed.

**Why `localStorage` not cookies?**
The API is at `/api/*` (same origin — Next.js rewrites). Cookies would work too, but:
- `localStorage` is simpler to read from JavaScript.
- No CSRF risk (localStorage can't be sent automatically by the browser in cross-site requests).
- The JWT validation logic in `onRehydrateStorage` can run synchronously on startup.

**Security note:** `localStorage` is readable by JavaScript. If there's ever an XSS vulnerability, the token could be stolen. Cookies with `HttpOnly` would protect against this. For a current capstone project, localStorage is acceptable; production systems should use `HttpOnly` cookies.

---

## The API Client (`lib/api.ts`)

This file is the single source of truth for all backend communication. It defines typed functions for every API endpoint, with centralised error handling and auth header injection.

### Base Axios Instance

```typescript
const api = axios.create({
  baseURL: '/api',    // Relative — Next.js rewrites /api/* to http://api-gateway:8080/api/*
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' }
});
```

**Request interceptor — adds auth headers automatically:**
```typescript
api.interceptors.request.use((config) => {
  const auth = getStoredAuth();           // reads from localStorage
  
  if (auth?.token) {
    // Validate token not expired before sending
    const payload = JSON.parse(atob(auth.token.split('.')[1]));
    if (Date.now() / 1000 > payload.exp) {
      useAuthStore.getState().logout();
      window.location.href = '/login';
      return Promise.reject(new Error('Token expired'));
    }
    
    config.headers.Authorization = `Bearer ${auth.token}`;
  }
  
  if (auth?.tenantId) {
    config.headers['X-Tenant-ID'] = auth.tenantId;
    // Note: backend ignores this header — tenantId comes from JWT.
    // Kept for debugging/logging convenience on the gateway.
  }
  
  return config;
});
```

**Response interceptor — centralised error handling:**
```typescript
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout();
      window.location.href = '/login?session=expired';
      return Promise.reject(error);
    }
    
    if (error.response?.status === 403) {
      throw new Error('You do not have permission to perform this action');
    }
    
    if ([500, 502, 503, 504].includes(error.response?.status)) {
      throw new Error('Service temporarily unavailable. Please try again.');
    }
    
    if (error.code === 'ECONNABORTED') {
      throw new Error('Request timed out after 30 seconds');
    }
    
    if (error.message === 'Network Error') {
      throw new Error('Network error. Please check your connection.');
    }
    
    return Promise.reject(error);
  }
);
```

**Why centralise error handling here?**
Without centralisation, every component that makes an API call would need to handle 401, 403, 500, timeout, and network errors separately. With centralised interceptors:
- Components only need to handle domain-specific errors (e.g., "this email already exists").
- Auth expiry redirects happen automatically everywhere.
- Error messages are consistent across the app.

### API Group Pattern

All endpoints are grouped by domain:

```typescript
export const vendorApi = {
  getAll: (page = 0, size = 50) =>
    api.get<PagedResponse<Vendor>>(`/vendors?page=${page}&size=${size}`)
       .then(r => r.data),

  getById: (id: number) =>
    api.get<Vendor>(`/vendors/${id}`).then(r => r.data),

  register: (data: CreateVendorRequest) =>
    api.post<Vendor>('/vendors/register', data).then(r => r.data),

  update: (id: number, data: UpdateVendorRequest) =>
    api.put<Vendor>(`/vendors/${id}`, data).then(r => r.data),

  verify: (id: number) =>
    api.post<Vendor>(`/vendors/${id}/verify`).then(r => r.data),

  uploadDocument: (vendorId: number, formData: FormData) =>
    fetch(`/api/vendors/${vendorId}/documents`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${getStoredAuth()?.token}` },
      body: formData   // FormData — cannot use Axios for multipart easily
    }).then(r => r.json()),

  // ...
};
```

**Why use raw `fetch` for file upload instead of Axios?**
When uploading `multipart/form-data`, the browser must set the `Content-Type` header to include the boundary string (`multipart/form-data; boundary=----WebKitFormBoundary...`). If Axios sets `Content-Type: application/json` (its default), the boundary is missing and the server can't parse the file. Using raw `fetch` with a `FormData` body lets the browser set the correct header automatically.

### Vendor Name Caching (Client-Side)

Many pages show tables with vendor IDs that need to be resolved to company names:

```typescript
const vendorNameCache = new Map<number, string>();

async function getCompanyNameMap(vendorIds: number[]): Promise<Map<number, string>> {
  const uncached = vendorIds.filter(id => !vendorNameCache.has(id));
  
  if (uncached.length > 0) {
    // Batch fetch only the ones we don't have
    const vendors = await Promise.all(uncached.map(id => vendorApi.getById(id)));
    vendors.forEach(v => vendorNameCache.set(v.vendorId, v.companyName));
  }
  
  return new Map(vendorIds.map(id => [id, vendorNameCache.get(id) ?? 'Unknown']));
}
```

This prevents N+1 API calls when displaying a table of 50 purchase orders — each with a `vendorId` that needs a display name.

---

## Role-Based UI

### `RequireRole` Component

```typescript
// components/require-role.tsx
export function RequireRole({ 
  roles, 
  children, 
  fallback = null 
}: { 
  roles: UserRole[];
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const { hasRole } = useAuthStore();
  return hasRole(roles) ? <>{children}</> : <>{fallback}</>;
}
```

Used throughout pages:
```tsx
<RequireRole roles={["ADMIN", "OFFICER"]}>
  <Button onClick={createRFQ}>Create RFQ</Button>
</RequireRole>
```

### Permission-Based Rendering

For finer control:
```tsx
const { hasPermission } = useAuthStore();

// Show export button only to users with reports:view permission
{hasPermission("reports:view") && (
  <Button onClick={exportCSV}>Download CSV</Button>
)}
```

**The DIRECTOR bug (now fixed):** Pages were listed under `RequireRole allowedRoles={[..., "DIRECTOR"]}` to allow the page to load, but inside the `useEffect` that fetches data, the role check was `hasRole(["ADMIN", "OFFICER", "MANAGER"])` — missing DIRECTOR. So DIRECTOR users could see the page but it was blank. The fix: add DIRECTOR to the `useEffect` guard on all 9 affected pages.

---

## Dialog Components (Edit Mode)

Feature dialogs (VendorDialog, RFQDialog) support both "create" and "edit" modes via an `initialData` prop:

```typescript
// components/vendor-dialog.tsx
interface VendorDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialData?: Vendor | null;  // if set, dialog is in edit mode
}

export function VendorDialog({ initialData, ...props }: VendorDialogProps) {
  const isEditing = !!initialData;
  
  const form = useForm<VendorFormData>({
    defaultValues: initialData ? {
      companyName: initialData.companyName,
      email: initialData.email,
      // ...
    } : { companyName: '', email: '' }
  });
  
  const onSubmit = async (data: VendorFormData) => {
    if (isEditing) {
      await vendorApi.update(initialData!.vendorId, data);
    } else {
      await vendorApi.register(data);
    }
    props.onSuccess();
    props.onClose();
  };
  
  return (
    <Dialog open={props.open} onOpenChange={props.onClose}>
      <DialogTitle>{isEditing ? "Edit Vendor" : "Register Vendor"}</DialogTitle>
      {/* form fields */}
    </Dialog>
  );
}
```

**Why one component instead of separate Create/Edit components?**
- Reduces duplication: form fields, validation schema, and layout are identical.
- Single place to fix bugs — a styling change or new field only needs to be made once.
- The `isEditing` flag only affects the submit handler and title.

---

## Session Expiry Warning

```typescript
// components/session-expiry-warning.tsx
export function SessionExpiryWarning() {
  const { token, logout } = useAuthStore();
  const [showWarning, setShowWarning] = useState(false);
  
  useEffect(() => {
    if (!token) return;
    
    const payload = JSON.parse(atob(token.split('.')[1]));
    const expiresAt = payload.exp * 1000;  // convert to ms
    const warningTime = expiresAt - 5 * 60 * 1000;  // 5 min before expiry
    
    const warningTimer = setTimeout(() => setShowWarning(true), 
                                    warningTime - Date.now());
    const logoutTimer = setTimeout(() => logout(), 
                                   expiresAt - Date.now());
    
    return () => { clearTimeout(warningTimer); clearTimeout(logoutTimer); };
  }, [token]);
  
  if (!showWarning) return null;
  return <Toast message="Your session expires in 5 minutes" />;
}
```

The JWT expiry is encoded in the token itself. The warning shows 5 minutes before it expires. When it expires, `logout()` is called which clears localStorage — the next request will hit the 401 interceptor and redirect to login.

---

## Analytics Dashboard

The analytics page uses **Recharts** for data visualisation:

```tsx
// analytics/page.tsx
const { data: dashboard } = await analyticsApi.getDashboard();
const { data: spendReport } = await analyticsApi.getSpendReport();

return (
  <div>
    {/* KPI Cards */}
    <StatCard title="Total Spend" value={formatCurrency(spendReport.totalSpend)} />
    <StatCard title="Active Vendors" value={dashboard.activeVendors} />
    
    {/* Spend by Vendor Chart */}
    <BarChart data={spendReport.spendByVendor}>
      <XAxis dataKey="vendorName" />
      <YAxis tickFormatter={formatCurrency} />
      <Bar dataKey="totalSpend" fill="#3b82f6" />
    </BarChart>
    
    {/* RFQ Status Chart */}
    <PieChart data={[
      { name: 'Open', value: dashboard.openRFQs },
      { name: 'Closed', value: dashboard.closedRFQs },
      { name: 'Awarded', value: dashboard.awardedRFQs }
    ]} />
  </div>
);
```

**Why use server-cached analytics data instead of calculating client-side?**
The analytics-service aggregates data from 3 services. Even if each service responds in 200ms, doing this on every client refresh would make dashboards slow. The 5-minute Redis cache in analytics-service means the aggregation happens once, and all users hitting the dashboard within 5 minutes share the same cached result.

---

## CSV Export

AUDITOR and users with `reports:view` permission can export data:

```typescript
function exportToCSV(data: PurchaseOrder[], filename: string) {
  const headers = ['PO Number', 'Vendor', 'Amount', 'Status', 'Created'];
  const rows = data.map(po => [
    po.poId,
    po.vendorName ?? po.vendorId,
    formatCurrency(po.totalAmount),
    po.status,
    formatDate(po.issueDate)
  ]);
  
  const csv = [headers, ...rows]
    .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');
  
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
```

**Note on `"${String(cell).replace(/"/g, '""')}"` :** This wraps each cell in quotes and escapes any internal quotes. Without this, a vendor name like `ACME, Ltd.` would produce an extra CSV column (the comma would be interpreted as a delimiter).

---

## Tenant Switcher

Users who belong to multiple organisations see a dropdown in the header:

```tsx
// components/header.tsx
const { user, setAuth } = useAuthStore();
const [tenants, setTenants] = useState<Tenant[]>([]);

useEffect(() => {
  authApi.getMyTenants().then(setTenants);
}, []);

// Only show if user has multiple tenants
{tenants.length > 1 && (
  <Select value={user?.tenantDomain} onValueChange={async (domain) => {
    const response = await authApi.switchTenant(domain);
    // setAuth replaces the stored token with the new one for the target tenant
    setAuth(
      { ...response.user, tenantId: response.tenantId },
      response.accessToken,
      { tenantId: response.tenantId, tenantName: response.tenantName }
    );
  }}>
    {tenants.map(t => (
      <SelectItem key={t.tenantId} value={t.domain}>{t.name}</SelectItem>
    ))}
  </Select>
)}
```

After switching, all subsequent API calls use the new JWT with the new tenant ID — all data shown is from the new organisation.
