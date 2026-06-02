# Authentication, Security, and Multi-Tenancy

> **Who should read this:** Any developer touching auth flows, security configuration, JWT handling, or multi-tenant data isolation. Also useful for understanding why certain decisions (e.g., no session cookies, no X-Tenant-ID headers) were made.

---

## How Authentication Works End-to-End

### 1. Login Flow

```
Browser → POST /api/auth/login { email, password, tenantDomain? }
       → API Gateway (no JWT required — public endpoint)
       → auth-service

auth-service:
  1. Resolve tenant (from tenantDomain param or email domain)
  2. Load user by (email, tenantId)
  3. Check approval status (VENDOR must be APPROVED)
  4. Check account lock (locked after 5 failed attempts)
  5. Validate password with BCrypt
  6. On failure: increment failedLoginAttempts; lock if ≥ 5
  7. On success: reset failedLoginAttempts to 0
  8. Build JWT with claims: userId, email, role, permissions, tenantId
  9. Return: { accessToken, userId, email, fullName, role, tenantId, tenantName, mustChangePassword }

Browser:
  - Stores token + user info in localStorage via Zustand persist
  - Attaches Authorization: Bearer {token} to every subsequent request
```

### 2. Subsequent Requests

```
Browser → GET /api/vendors (with Authorization: Bearer eyJhbGci...)
       → API Gateway JwtAuthenticationFilter:
           - Extract Bearer token
           - Validate HMAC-SHA256 signature
           - Check expiration
           - If invalid: return 401
           - If valid: forward request downstream
       → vendor-service JwtAuthenticationFilter:
           - Re-validates the same token (defence in depth)
           - Extracts tenantId, userId, role from claims
           - Populates SecurityContext
           - Sets TenantContext (ThreadLocal) with tenantId
       → VendorController → VendorService
           - TenantAspect intercepts every @Service method
           - Enables Hibernate @Filter(tenantId = TenantContext.get())
           - All JPA queries automatically append WHERE tenant_id = {tenantId}
```

---

## JSON Web Tokens (JWT)

### What Is a JWT?

A JWT is a cryptographically signed string that contains claims (key-value pairs). Because it is signed with a secret key, the recipient can verify it hasn't been tampered with — without asking the issuer (auth-service) to confirm.

```
eyJhbGciOiJIUzI1NiJ9          ← Header (algorithm: HMAC-SHA256)
.eyJ1c2VySWQiOjEsInRlbmFudElkI ← Payload (the claims — base64 encoded, NOT encrypted)
.SflKxwRJSMeKKF2QT4fwpMeJf36P0  ← Signature (HMAC-SHA256(header.payload, secret))
```

**The payload is readable by anyone** — it's base64, not encrypted. The signature just proves it wasn't modified. **Never put secrets in JWT claims.**

### Claims in ProcurePro JWTs

```java
// JwtTokenProvider.java (auth-service)
Jwts.builder()
    .subject(userId.toString())        // "sub" — the user's database ID
    .claim("email", email)
    .claim("role", role)               // e.g., "ADMIN", "VENDOR"
    .claim("permissions", permissions) // comma-separated permission string
    .claim("tenantId", tenantId)       // the organisation this user belongs to
    .expiration(new Date(System.currentTimeMillis() + expirationMs))  // 8 hours
    .signWith(secretKey)               // HMAC-SHA256 with shared secret
    .compact();
```

### Why Embed Permissions in the JWT?

Alternative approach: store permissions in DB, look them up on every request.

**Problem:** Every API call would require a database round-trip to load permissions — adding latency and DB load.

**ProcurePro's approach:** Embed the permission string in the JWT at login time. Services extract permissions from the token with zero DB queries. The token is signed, so it can't be forged.

**Trade-off:** If an admin changes a user's role, the change doesn't take effect until the user's current JWT expires (up to 8 hours). For an enterprise procurement system this is acceptable — access changes are not emergency operations.

### Why Not Use Session Cookies?

Session cookies require the server to maintain session state. In a microservices system:
- Session state would need to be shared across all services (using a shared Redis or similar).
- This creates a dependency: every service needs access to the session store.
- Stateless JWTs let each service independently validate auth without any shared state.

JWTs scale horizontally with zero coordination overhead.

---

## Multi-Tenancy: How Data Isolation Works

### The Core Problem

Multiple organisations share the same database tables. Organisation A must never see Organisation B's data, even if they both have a user with email `admin@company.com`.

### Strategy: Shared Schema, Row-Level Isolation

Every table that contains tenant-specific data has a `tenant_id` column. The Hibernate `@Filter` annotation automatically appends `WHERE tenant_id = :tenantId` to every query when enabled.

```java
// Example entity (User.java in auth-service)
@Entity
@FilterDef(name = "tenantFilter", parameters = @ParamDef(name = "tenantId", type = Long.class))
@Filter(name = "tenantFilter", condition = "tenant_id = :tenantId")
public class User {
    @Column(name = "tenant_id", nullable = false)
    private Long tenantId;
    // ...
}
```

### TenantContext — The ThreadLocal Carrier

The tenant ID needs to travel from the HTTP request (JWT claim) down to the Hibernate query. It does this through a `ThreadLocal` variable:

```java
// TenantContext.java
public class TenantContext {
    private static final ThreadLocal<Long> CURRENT_TENANT = new ThreadLocal<>();

    public static void setTenantId(Long tenantId) { CURRENT_TENANT.set(tenantId); }
    public static Long getTenantId() { return CURRENT_TENANT.get(); }
    public static void clear() { CURRENT_TENANT.remove(); }  // always clean up!
}
```

**ThreadLocal** stores a value that is unique per thread. In a web server, each HTTP request runs on its own thread, so `TenantContext.getTenantId()` always returns the right tenant for the current request — even if 100 requests are being processed simultaneously.

### JwtAuthenticationFilter — Where Tenant Is Set

```java
// JwtAuthenticationFilter.java (in every service)
Long tenantId = jwtTokenProvider.extractTenantId(token);
TenantContext.setTenantId(tenantId);

// After request processing:
TenantContext.clear();  // prevent thread pool reuse from leaking the tenant ID
```

### TenantAspect — Where the Filter Is Enabled

```java
// TenantAspect.java
@Aspect
@Component
public class TenantAspect {
    @Around("execution(public * com.procurement.*.service.*.*(..))")
    public Object applyTenantFilter(ProceedingJoinPoint joinPoint) throws Throwable {
        Long tenantId = TenantContext.getTenantId();
        // Enable Hibernate filter with the current tenant ID
        session.enableFilter("tenantFilter").setParameter("tenantId", tenantId);
        try {
            return joinPoint.proceed();
        } finally {
            session.disableFilter("tenantFilter");
        }
    }
}
```

This AOP advice wraps **every public service method** automatically. Developers don't need to remember to filter by tenant — it happens automatically by infrastructure.

**Why AOP (aspect-oriented programming) instead of putting filter logic in each service method?**

Because it's a cross-cutting concern. If you added `session.enableFilter(...)` to every service method manually:
- 50 service methods = 50 places to forget to add it.
- One forgotten place = a security hole.
- AOP centralises it in one interceptor that runs for all of them.

### Why No X-Tenant-ID Header?

Some multi-tenant systems accept a `X-Tenant-ID` HTTP header to identify the tenant. ProcurePro deliberately **does not** do this.

**Why?** Because a header can be spoofed. A malicious user could send `X-Tenant-ID: 2` to access tenant 2's data even while authenticated for tenant 1.

The tenant ID is embedded inside the JWT, which is **cryptographically signed**. Changing the tenant ID in the JWT would invalidate the signature — the gateway would reject it.

**The rule:** All tenant identity comes from the signed JWT. Period.

### Tenant Switching

A user (e.g., a consultant) can belong to multiple organisations. The `POST /api/auth/switch-tenant` endpoint:
1. Validates that the user's email exists in the target tenant.
2. Issues a **new JWT** with the target tenant's `tenantId`.
3. The old JWT remains valid until expiry (can't be revoked — JWT trade-off).

The frontend stores the new token and all subsequent requests use the target tenant's data.

---

## Roles and Permissions

### Two Levels of Access Control

**Level 1 — Role-based (coarse-grained):** Certain endpoints require a specific role.
```java
// SecurityConfig.java
.requestMatchers("/api/super-admin/**").hasRole("SUPER_ADMIN")
.requestMatchers("/api/admin/**").hasAnyRole("ADMIN", "SUPER_ADMIN")
```

**Level 2 — Permission-based (fine-grained):** Specific actions require specific permissions.
```typescript
// Frontend: auth-store.ts
const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  ADMIN: [
    "vendors:read", "vendors:create", "vendors:update", "vendors:verify",
    "rfq:create", "rfq:update", "rfq:close",
    "bids:evaluate", "bids:award",
    "po:create", "po:approve", "po:reject",
    "invoices:validate", "disputes:resolve",
    "scoring:read", "analytics:view",
    "users:read", "users:create", "users:update",
    "settings:view", "settings:update",
    "audit:read", "reports:view", "compliance:view",
    // ... all permissions
  ],
  OFFICER: [
    "vendors:read", "vendors:create", "vendors:update", "vendors:verify",
    "rfq:create", "rfq:update", "rfq:close",
    "bids:read", "bids:evaluate", "bids:award",
    "po:create",           // can CREATE but NOT approve
    "requisitions:create",
    "scoring:read", "analytics:view", "reports:view",
    // ...
  ],
  MANAGER: [
    "po:read", "po:approve", "po:reject",    // approval power
    "requisitions:read", "requisitions:approve",
    "vendors:read", "rfq:read", "bids:read",
    // mostly read + approve
  ],
  VENDOR: [
    "bids:submit",         // can only submit bids
    "rfq:read",            // can see RFQs
    "po:read",             // can see their own POs
    "deliveries:read", "invoices:read",
    "scoring:read",        // can see their own scores
  ],
  // ...
};
```

**Why maintain permissions on the frontend?** The frontend uses them to show/hide buttons and pages — no point rendering a "Create RFQ" button for a VENDOR user. The backend enforces the same rules on every API call, so this is purely UX optimisation.

### The Permission Check Pattern

```typescript
// Throughout the frontend
const { hasPermission, hasRole } = useAuthStore();

// Show create button only if user can create RFQs
{hasPermission("rfq:create") && <Button>Create RFQ</Button>}

// Restrict page entirely to certain roles
<RequireRole roles={["ADMIN", "OFFICER", "MANAGER"]}>
  <ProcurementPage />
</RequireRole>
```

---

## Password Security

**BCrypt hashing** (strength factor 10):
- BCrypt is a one-way hash specifically designed for passwords.
- "Strength 10" means 2^10 = 1024 hash rounds — intentionally slow to prevent brute-force.
- Even if the database is compromised, passwords cannot be reversed.
- Each hash includes a random salt, so identical passwords produce different hashes.

**Why strength 10 and not higher?**
Higher = more CPU per login. 10 is the Spring Security default — ~100ms per hash, which is imperceptible to humans but makes brute-forcing 100x slower than strength 7.

**Account lockout:**
- 5 consecutive failed attempts → `accountLocked = true`.
- Admin can unlock via `POST /api/auth/users/{userId}/unlock`.
- Prevents brute-force guessing even with simple passwords.

**Forced password change:**
- New users created by admins have `mustChangePassword = true`.
- The frontend checks this flag and redirects to the change-password page before allowing any other navigation.

---

## Vendor Self-Registration Flow

Vendors register themselves without admin intervention, but cannot log in until approved:

```
Vendor → POST /api/auth/register { email, password, companyName, ... }
auth-service:
  - Creates User with role = VENDOR
  - Sets accountLocked = true  ← cannot log in yet
  - Sets approvalStatus = PENDING_APPROVAL

Admin sees pending approvals in dashboard:
  → POST /api/auth/vendor-approvals/{userId}/approve
  auth-service:
    - Sets accountLocked = false
    - Sets approvalStatus = APPROVED
    - Sends approval email to vendor

Vendor can now log in.
```

**Why lock the account?** Because procurement is a trust-sensitive domain. An unverified vendor submitting fraudulent bids could cause real financial harm. The admin reviews vendor credentials before granting access.

---

## CORS Configuration

CORS (Cross-Origin Resource Sharing) controls which browser origins can call the API.

**API Gateway:**
```yaml
# application.yml
globalcors:
  corsConfigurations:
    '[/**]':
      allowedOrigins:
        - "http://localhost:3000"
        - "http://frontend:3000"
        - "${FRONTEND_URL}"
      allowedMethods: [GET, POST, PUT, DELETE, PATCH, OPTIONS]
      allowedHeaders: [Authorization, Content-Type, X-User-Id]
      allowCredentials: true   # needed for cookie-based flows (future use)
```

**Internal services** (vendor, rfq, etc.) — `allowCredentials: false`, explicit allowed headers only. These services are not supposed to be called directly from a browser; they sit behind the gateway. The restrictive CORS is defence-in-depth.

**Why not `allowedOrigins: "*"` (wildcard)?**
Wildcard with `allowCredentials: true` is rejected by browsers entirely. Explicit origins are also more secure — they prevent third-party sites from making authenticated API calls on behalf of your users.

---

## Audit Logging

Every significant auth action is written to `audit_logs` in `authdb`:

```java
// AuditLog.java
@Entity
public class AuditLog {
    private Long userId;
    private Long tenantId;
    private String action;        // "LOGIN", "LOGOUT", "REGISTER", "APPROVE_VENDOR", ...
    private String ipAddress;
    private LocalDateTime timestamp;
    private String details;       // JSON with extra context
}
```

AUDITOR role users can query audit logs via `GET /api/admin/audit-logs`. This provides a non-repudiable record of who did what, when, from which IP.
