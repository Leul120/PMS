# Data Layer — Database Design, Multi-Tenancy, and Caching

> **Who should read this:** Developers designing new entities, debugging data isolation issues, or tuning query performance. Also useful for understanding the Redis caching strategy.

---

## Database Technology Choice: PostgreSQL

PostgreSQL was chosen over alternatives for these reasons:

| Feature | Why it matters here |
|---|---|
| **JSONB column type** | Tenant settings stored as flexible key-value JSON without needing extra tables |
| **Row-level security** (via Hibernate @Filter) | Enables multi-tenancy isolation without schema duplication |
| **ACID transactions** | Financial amounts (BigDecimal) and approval workflows need guaranteed consistency |
| **Advanced indexing** | Composite indexes on (tenant_id, status) optimise the most common queries |
| **Optimistic locking** | `@Version` columns work natively with JPA/Hibernate |

**Why not MongoDB?**
MongoDB is excellent for document-centric data with variable schemas. Procurement data is highly relational (PO → Bid → RFQ → Vendor → Delivery → Invoice → ThreeWayMatch). Enforcing these relationships with foreign keys and joins is what relational databases excel at.

---

## Schema Management: Why `ddl-auto: update` (and its Limitations)

All services use:
```yaml
spring:
  jpa:
    hibernate:
      ddl-auto: update
```

This tells Hibernate to automatically create or alter tables to match the entity definitions on startup.

**Why is this used?**
- Fast for development: add a field to an entity and it appears in the DB automatically.
- No migration files to write during early development when schemas change frequently.

**Production Warning:** `ddl-auto: update` is not safe for production:
- It can't drop columns (for that, you'd need `ddl-auto: create-drop`, which destroys data).
- It doesn't handle complex migrations like column renames.
- Schema changes run without a review/approval step.
- Schema migration failures crash the application at startup.

For production, the right tool is **Flyway** or **Liquibase** — versioned migration scripts that are reviewed, tested, and applied incrementally. This is the next infrastructure improvement needed.

---

## Multi-Tenancy at the Database Level

### The `tenant_id` Column

Every business entity has a `tenant_id` column:

```sql
-- Example: vendors table
CREATE TABLE vendors (
    vendor_id BIGSERIAL PRIMARY KEY,
    tenant_id BIGINT NOT NULL,        -- Always present
    company_name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    compliance_status VARCHAR(50),
    ...
    CONSTRAINT uq_vendor_email_tenant UNIQUE (email, tenant_id)
    -- Note: email is unique PER tenant, not globally
);

CREATE INDEX idx_vendors_tenant_id ON vendors(tenant_id);
CREATE INDEX idx_vendors_tenant_status ON vendors(tenant_id, compliance_status);
```

**Why unique per tenant rather than globally?**
Two different organisations could each have a vendor called `acme@supplies.com`. That's fine — they're different business relationships for different organisations. The unique constraint is `(email, tenant_id)`, not just `email`.

### Hibernate `@Filter` Implementation

The multi-tenancy filter is defined at the entity level:

```java
@Entity
@FilterDef(
    name = "tenantFilter",
    parameters = @ParamDef(name = "tenantId", type = Long.class)
)
@Filter(name = "tenantFilter", condition = "tenant_id = :tenantId")
public class Vendor {
    @Column(name = "tenant_id", nullable = false)
    private Long tenantId;
    // ...
}
```

When the filter is enabled by `TenantAspect`, Hibernate automatically appends the condition to all queries for this entity:

```sql
-- Without filter:
SELECT * FROM vendors WHERE vendor_id = 123;

-- With filter enabled:
SELECT * FROM vendors WHERE vendor_id = 123 AND tenant_id = 5;
```

If a user from tenant 5 somehow passes `vendorId = 456` (which belongs to tenant 7), the query returns no results rather than leaking data. **The filter is the last line of defence** (JWT signature + TenantContext are the first lines).

### The analytics-service Exception

`analytics-service` has no database of its own and does not use `TenantAspect`. It passes the JWT token through when calling downstream services via HTTP — those services apply their own tenant filters. The analytics service is a **read-only aggregator** and never writes tenant-specific data.

---

## Key Database Indexes

Indexes are pre-sorted data structures that speed up specific query patterns. Without them, every query scans the full table.

### Index Design Philosophy

Every table has:
1. **`tenant_id` alone** — for queries like "count all vendors for this tenant".
2. **`(tenant_id, status)`** — for the most common filtered list: "show me all OPEN RFQs for this tenant".
3. **Domain-specific indexes** for common joins.

Examples:

```sql
-- rfqs table
CREATE INDEX idx_rfqs_tenant_id ON rfqs(tenant_id);
CREATE INDEX idx_rfqs_tenant_status ON rfqs(tenant_id, status);
CREATE INDEX idx_rfqs_deadline_status ON rfqs(deadline, status);
-- ^ for the scheduler: "find all RFQs where deadline < NOW() AND status = 'Open'"

-- bids table
CREATE INDEX idx_bids_rfq_id ON bids(rfq_id);
CREATE INDEX idx_bids_vendor_id ON bids(vendor_id);
CREATE INDEX idx_bids_rfq_score ON bids(rfq_id, total_score DESC);
-- ^ for "show bids for RFQ X sorted by score" — the sort is pre-computed

-- purchase_orders table
CREATE INDEX idx_po_tenant_id ON purchase_orders(tenant_id);
CREATE INDEX idx_po_tenant_status ON purchase_orders(tenant_id, status);
CREATE INDEX idx_po_vendor_id ON purchase_orders(vendor_id);
CREATE INDEX idx_po_created_by ON purchase_orders(created_by);
-- ^ for "show all POs created by user X" (officer dashboard)
```

### The Most Important Index: `(tenant_id, status)`

This appears on almost every entity. The reason: the most common UI query pattern is:

```
"Show me all [entities] for my organisation that are in [status]"
```

Examples:
- Dashboard: "Show all OPEN RFQs for tenant 1" 
- Officer view: "Show all PENDING APPROVAL purchase orders for tenant 1"
- Manager queue: "Show all SUBMITTED requisitions for tenant 1"

Without this composite index, the DB would scan every row, then filter by tenant, then filter by status — O(n) full table scan. With the index, it directly jumps to only matching rows — O(log n).

---

## Optimistic Locking with `@Version`

Several entities have a `version` column:

```java
@Entity
public class PurchaseOrder {
    @Version
    private Integer version;
    // ...
}
```

**The problem this solves:**
Two officers simultaneously open PO #123 for editing. They both read `version = 5`. Officer A saves first, bumping version to 6. When Officer B tries to save, Hibernate checks: "Is the version I read (5) still the current version (6)?" — It's not. Hibernate throws `OptimisticLockException`.

Without this, Officer B's save would silently overwrite Officer A's changes — a "lost update" race condition.

**Why "optimistic"?** Optimistic locking doesn't lock the row when reading (unlike `SELECT FOR UPDATE`). It bets that most of the time no one else will modify the record concurrently. Only at save time does it check. This is appropriate for low-contention data (most POs are only edited by one officer at a time).

---

## Redis Caching Strategy

### Architecture: One Redis Per Service

Each service has its own Redis instance:

```yaml
# docker-compose.yml
redis-vendor:
  image: redis:7-alpine
  command: redis-server --maxmemory 67108864 --maxmemory-policy allkeys-lru
  ports:
    - "6381:6379"
```

This prevents:
- **Namespace collisions:** vendor-service uses key `"vendor:123"`, auth-service might also use `"user:123"` — in a shared Redis, prefixing prevents collision, but isolated instances make it impossible.
- **Memory contention:** If scoring-service builds a large cache, it can't starve vendor-service's cache.
- **Eviction bleed:** LRU eviction in one service doesn't kick out another service's hot data.

### Tenant-Aware Cache Keys

All cache keys are prefixed with the tenant ID:

```java
// CacheConfig.java — custom key generator
@Bean
public KeyGenerator tenantAwareKeyGenerator() {
    return (target, method, params) -> {
        Long tenantId = TenantContext.getTenantId();
        return "tenant:" + tenantId + ":" + method.getName() + ":" 
               + Arrays.stream(params).map(Object::toString).collect(joining(","));
    };
}
```

**Why?** Without tenant-aware keys, a request from tenant A for `getVendorById(123)` would cache under key `vendor:123`. A request from tenant B for `getVendorById(123)` would hit that cache and receive tenant A's vendor data. Catastrophic data leak.

With tenant-aware keys: `tenant:1:vendor:123` and `tenant:2:vendor:123` are separate cache entries.

### Cache TTL (Time-to-Live) per Service

| Service | Cache Name | TTL | Reason |
|---|---|---|---|
| auth-service | `users` | 30 min | User profiles don't change frequently |
| vendor-service | `vendors` | 15 min | Vendor data changes occasionally |
| rfq-bidding-service | `rfqs` | 5 min | RFQ status changes during bid period |
| analytics-service | `dashboard` | 5 min | Near-real-time dashboard acceptable |
| analytics-service | `spend-report` | 10 min | Spend data slightly less volatile |

### Cache Invalidation

When an entity is modified, its cache entry must be evicted:

```java
// VendorService.java
@CacheEvict(value = "vendors", key = "#tenantId + ':' + #vendorId")
public VendorResponse updateVendor(Long vendorId, VendorUpdateRequest req) {
    // ...
}
```

**Frontend also invalidates its in-memory vendor name cache:**
```typescript
// After any vendor update/verify/status change:
invalidateVendorCache();  // clears the in-memory Map
```

### Distributed Locks (Redisson)

The auth-service uses **Redisson** for distributed locks to prevent race conditions on concurrent user updates:

```java
// auth-service
@DistributedLock(
    key = "'user:update:' + #userId",
    waitTime = 5,     // wait up to 5s to acquire the lock
    leaseTime = 30    // auto-release after 30s (prevents deadlock if service crashes)
)
public UserResponse updateUser(Long userId, UpdateUserRequest req) {
    // Only one thread can be here at a time for a given userId
}
```

**Why needed?** A user could click "Update Profile" twice quickly (or an admin makes a change while the user is also changing their profile). Without the lock, both read the old state, both modify it, and one save overwrites the other. The distributed lock serialises concurrent modifications.

**Why a distributed lock (Redis) instead of Java's `synchronized`?**
`synchronized` only works within a single JVM. If you run 3 instances of auth-service behind a load balancer, `synchronized` would allow concurrent updates across different instances. Redis-based locks are shared across all instances.

---

## The `analytics-service` Redis Pattern

analytics-service has no database — it uses Redis as its only persistent layer:

```java
// AnalyticsService.java
public DashboardOverview getDashboardOverview(Long tenantId) {
    String cacheKey = "tenant:" + tenantId + ":dashboard";
    
    // Try cache first
    DashboardOverview cached = redisTemplate.opsForValue().get(cacheKey);
    if (cached != null) return cached;
    
    // Cache miss: aggregate from upstream services
    List<Vendor> vendors = vendorClient.getAll(tenantId);
    List<RFQ> rfqs = rfqClient.getAll(tenantId);
    List<PurchaseOrder> pos = procurementClient.getAll(tenantId);
    
    DashboardOverview overview = aggregate(vendors, rfqs, pos);
    
    // Store for 5 minutes
    redisTemplate.opsForValue().set(cacheKey, overview, 5, TimeUnit.MINUTES);
    return overview;
}
```

**The analytics-service pattern in one sentence:** Redis as a short-lived aggregation cache, upstream services as the source of truth.
