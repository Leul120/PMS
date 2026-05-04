# Redis Caching, Rate Limiting & Distributed Locking

Comprehensive Redis implementation following modern best practices for the Procurement Management System.

## Overview

- **Caching**: Multi-layer distributed caching with TTL management
- **Rate Limiting**: Token bucket, fixed window, sliding window algorithms
- **Distributed Locking**: Redisson-based locking with automatic lease renewal

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      API Gateway                             │
│  ┌─────────────────────────────────────────────────────────┐│
│  │  Rate Limiting (Redis Token Bucket)                     ││
│  │  - Per IP: 100 req/min                                  ││
│  │  - Per User: Varies by endpoint                          ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                      Redis Cluster                           │
│  ┌──────────────┬──────────────┬───────────────────────────┐│
│  │   Caching    │ Rate Limits  │ Distributed Locks         ││
│  │   Keys       │   Buckets    │ Redisson RLock            ││
│  └──────────────┴──────────────┴───────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
┌───────▼──────┐    ┌────────▼────────┐   ┌───────▼────────┐
│   Vendors    │    │ Purchase Orders │   │     RFQs       │
│   Service    │    │    Service      │   │  Bidding       │
│  (Cached)    │    │    (Cached)     │   │   Service      │
└──────────────┘    └─────────────────┘   └────────────────┘
```

## Features

### 1. Caching

**Cache Names** (`CacheNames.java`):
```java
CacheNames.VENDORS           // 30 min TTL
CacheNames.RFQS              // 15 min TTL
CacheNames.PURCHASE_ORDERS   // 20 min TTL
CacheNames.USERS             // 60 min TTL
CacheNames.ANALYTICS         // 120 min TTL
```

**Usage Example**:
```java
@Cacheable(value = CacheNames.VENDORS, key = CacheNames.VENDOR_BY_ID + ":#vendorId")
public Optional<Vendor> getVendorById(Long vendorId) {
    return vendorRepository.findById(vendorId);
}

@CacheEvict(value = CacheNames.VENDORS, key = CacheNames.VENDOR_BY_ID + ":#vendorId")
public Vendor updateVendor(Long vendorId, Vendor vendor) {
    // Update logic
}
```

**Cache Aside with Lock** (Cache stampede prevention):
```java
// Automatic double-check locking
cacheService.getWithLock(key, supplier, ttl, lockKey);
```

### 2. Rate Limiting

**Strategies** (`RateLimitStrategy.java`):
- **TOKEN_BUCKET**: Burst capacity + steady rate (recommended for APIs)
- **FIXED_WINDOW**: Simple counter, resets at interval boundaries
- **SLIDING_WINDOW**: Smooth limiting, no boundary bursts
- **LEAKY_BUCKET**: Queue-based for background jobs

**API Gateway Configuration**:
```yaml
# Global: 100 req/min per IP
default-filters:
  - name: RequestRateLimiter
    args:
      redis-rate-limiter.replenishRate: 100
      redis-rate-limiter.burstCapacity: 150

# Auth endpoint: 20 req/min (login/refresh)
- name: RequestRateLimiter
  args:
    redis-rate-limiter.replenishRate: 20
    redis-rate-limiter.burstCapacity: 50
```

**Service-Level Annotation**:
```java
@RateLimiter(
    key = "'api:' + #request.remoteAddr",
    capacity = 100,
    refillTokens = 10,
    refillPeriod = 1,
    refillUnit = TimeUnit.MINUTES,
    strategy = RateLimitStrategy.TOKEN_BUCKET
)
@GetMapping("/api/vendors")
public List<Vendor> getVendors() { }
```

**Response Headers**:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 85
X-RateLimit-Reset: 1704067200
Retry-After: 60  (when exceeded)
```

### 3. Distributed Locking

**Redisson Features**:
- Auto-expiring leases with renewal
- Fair locks (FIFO queue)
- Read/Write locks
- Multi-locks (atomic multiple resource locking)

**Declarative with @DistributedLock**:
```java
@DistributedLock(
    key = "'vendor:create:' + #vendor.vendorCode",
    waitTime = 5,      // Wait 5s to acquire
    leaseTime = 30,    // Auto-release after 30s
    timeUnit = TimeUnit.SECONDS
)
public Vendor createVendor(Vendor vendor) { }
```

**SpEL Expressions**:
```java
@DistributedLock(key = "'order:' + #orderId")           // Parameter
@DistributedLock(key = "'inventory:' + #sku + ':warehouse:' + #warehouseId")
@DistributedLock(key = "'batch:' + T(java.util.UUID).randomUUID()")  // Random
```

**Programmatic API**:
```java
// Simple lock
distributedLockService.executeWithLock("resource-key", () -> {
    // Critical section
    return result;
});

// Fair lock (FIFO)
distributedLockService.executeWithFairLock("queue-key", operation);

// Read/Write lock
distributedLockService.executeWithReadLock("config-key", readOperation);
distributedLockService.executeWithWriteLock("config-key", writeOperation);

// Multi-lock (atomic)
distributedLockService.executeWithMultiLock(
    List.of("account:1", "account:2"),
    10, 30, TimeUnit.SECONDS,
    transferOperation
);
```

## Docker Compose

```yaml
redis:
  image: redis:7-alpine
  ports:
    - "6379:6379"
  volumes:
    - redis-data:/data
  command: redis-server --appendonly yes --maxmemory 256mb --maxmemory-policy allkeys-lru
```

## Kubernetes

```yaml
# Deploy Redis
kubectl apply -f k8s/redis.yaml

# Verify
kubectl get pods -n procurement -l app=redis
kubectl get svc -n procurement redis
```

## Best Practices

### Caching
1. **TTL Strategy**: Short TTL for volatile data (15-30 min), long TTL for stable data (1-2 hours)
2. **Cache Key Design**: Hierarchical with colons (`vendors:by-id:123`)
3. **Eviction**: Cascade evict related entities
4. **Stampede Prevention**: Use `getWithLock()` for hot keys

### Rate Limiting
1. **Per-User Limits**: Authenticated users get higher limits than anonymous
2. **Endpoint Sensitivity**: Lower limits for expensive operations (analytics, reports)
3. **Gradual Degradation**: Return 429 with `Retry-After` header
4. **Monitoring**: Track rate limit hits for capacity planning

### Distributed Locking
1. **Lease Time**: Always set (prevents deadlocks on crashes)
2. **Wait Time**: Keep short (fail fast vs. queue)
3. **Lock Granularity**: Fine-grained locks reduce contention
4. **SpEL Keys**: Include entity ID in key for entity-level locks

## Configuration

### application.yml
```yaml
spring:
  data:
    redis:
      host: ${REDIS_HOST:localhost}
      port: ${REDIS_PORT:6379}
      timeout: 2000
      database: 0
      lettuce:
        pool:
          max-active: 8
          max-idle: 8
          min-idle: 0

redisson:
  connection:
    minimum-idle-size: 5
    pool-size: 10
```

### Environment Variables
```bash
SPRING_DATA_REDIS_HOST=redis
SPRING_DATA_REDIS_PORT=6379
REDISSON_CONNECTION_POOL_SIZE=10
```

## Monitoring

### Cache Metrics
```java
@Autowired private CacheMetrics cacheMetrics;

// Get stats
Map<String, Object> stats = cacheMetrics.getCacheStats();
```

### Logs
```
Cache hit for key: vendors:by-id:123
Cache miss for key: rfqs:by-id:456, computing value
Lock acquired: lock:vendor:create:ACME-001
Lock released: lock:vendor:create:ACME-001
Rate limit exceeded for key: ratelimit:api:192.168.1.1
```

## Testing

```bash
# Rate limit test
for i in {1..110}; do
  curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/api/vendors
done
# Output: 200 200 ... 429 429

# Cache test
curl http://localhost:8080/api/vendors/1  # Miss (slow)
curl http://localhost:8080/api/vendors/1  # Hit (fast)

# Lock test (concurrent)
curl -X POST http://localhost:8080/api/vendors &
curl -X POST http://localhost:8080/api/vendors &
# Second request waits or fails based on lock config
```
