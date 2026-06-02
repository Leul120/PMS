# Architecture — Microservices Design

> **Who should read this:** Developers new to the codebase who want to understand how the system is structured, why it was split into multiple services, and how those services talk to each other.

---

## Why Microservices?

A monolith puts all code in one deployable unit. It's simple to start with, but as the system grows:
- A bug in one area can crash the whole system.
- You can't scale only the heavily-loaded part (e.g., scaling the entire monolith because RFQ submission gets heavy traffic).
- Different teams can't deploy independently without stepping on each other.
- Technology choices are locked in for the entire codebase.

ProcurePro uses **microservices** — each domain of the business lives in its own independently deployable service with its own database. The tradeoff is more operational complexity upfront, but the system can scale, be maintained, and be understood in pieces.

**The specific boundaries were drawn by business domain** (Domain-Driven Design):

- Everything about *who vendors are* → `vendor-service`
- Everything about *requesting and bidding* → `rfq-bidding-service`
- Everything about *approving and ordering* → `procurement-service`
- Everything about *receiving and paying* → `delivery-invoice-service`
- Everything about *how good vendors are* → `scoring-service`

This is called **bounded context isolation** — each service owns its data and its logic. No service reaches directly into another service's database.

---

## Service Map

```
                          ┌─────────────────────────────────────────┐
                          │          Browser / Next.js (3000)         │
                          └──────────────────┬──────────────────────┘
                                             │  HTTP
                          ┌──────────────────▼──────────────────────┐
                          │         API Gateway (8080)                │
                          │  - JWT validation                         │
                          │  - Rate limiting                          │
                          │  - Route to correct microservice          │
                          └──┬─────┬─────┬─────┬──────┬──────┬──────┘
                             │     │     │     │      │      │
              ┌──────────────▼┐  ┌─▼──┐ ┌▼──┐ ┌▼────┐│   ┌──▼──┐
              │  auth-service │  │    │ │   │ │     ││   │     │
              │  (8081)       │  │vend│ │rfq│ │proc ││   │ ... │
              └───────────────┘  │  or│ │   │ │     ││   │     │
                                 │    │ │bid│ │svc  ││   └─────┘
                                 │svc │ │   │ │     │
                                 │8082│ │8083│ │8084 │
                                 └────┘ └────┘ └─────┘

All services publish/consume events via:
         ┌─────────────────────────────────┐
         │      Apache Kafka (9092)         │
         └────────────┬────────────────────┘
                      │ consumed by
         ┌────────────▼────────────────────┐
         │   notification-service (8089)    │  ← sends emails + in-app alerts
         └─────────────────────────────────┘
         ┌─────────────────────────────────┐
         │   scoring-service (8086)         │  ← updates vendor KPIs
         └─────────────────────────────────┘
```

---

## The API Gateway — The Front Door

**File:** `api-gateway/src/main/resources/application.yml`

Every HTTP request from the browser goes to `localhost:8080` first — the API Gateway. Nothing reaches the backend services directly.

### What the gateway does:

**1. JWT Validation**
Every request (except login/register/reset-password) must carry a valid JWT in the `Authorization: Bearer ...` header. The gateway validates the signature and expiration. Invalid tokens get a `401 Unauthorized` immediately — the request never reaches the downstream service.

This is done in `JwtAuthenticationFilter.java` which runs as a Spring Cloud Gateway `GlobalFilter` with order `-100` (runs before everything else).

**Why at the gateway and not in each service?**
Each service _also_ validates the JWT (defence in depth), but centralising the first check means a failed auth never consumes resources in 10 different services. One doorman, not 10.

**2. Routing**
The gateway maps URL prefixes to service addresses:

```yaml
routes:
  - id: auth-service
    uri: http://auth-service:8081
    predicates:
      - Path=/api/auth/**

  - id: vendor-service
    uri: http://vendor-service:8082
    predicates:
      - Path=/api/vendors/**

  - id: rfq-bidding-service
    uri: http://rfq-bidding-service:8083
    predicates:
      - Path=/api/rfqs/**, /api/bids/**

  # ... etc
```

The browser calls `/api/vendors/123` → gateway strips nothing, forwards to `http://vendor-service:8082/api/vendors/123`.

**3. Rate Limiting**
`RateLimitConfig.java` defines 5 different rate-limit key strategies:
- **IP-based:** Limit requests per client IP (protects against simple flooding)
- **User-based:** Limit requests per authenticated user (protects against abusive accounts)
- **Tenant-based:** Limit requests per organisation (prevents one customer starving others)
- **Endpoint+User:** Per-user per-endpoint (prevents hammering a specific API)
- **API Key:** For programmatic/machine-to-machine access

**Why Redis for rate limiting?** Rate limiting state must be shared across all gateway instances (if you run multiple gateways behind a load balancer). A local counter would reset on each pod. Redis provides a shared atomic counter.

---

## Service-to-Service Communication

Services sometimes need data from each other. For example:
- `rfq-bidding-service` needs to know the vendor's email to embed in bid events.
- `analytics-service` needs to aggregate data from 3 services to build a dashboard.

There are two communication patterns used:

### Pattern 1: Synchronous HTTP (Feign Clients)

Used when the caller needs the response immediately to continue its work.

**Example:** `rfq-bidding-service` → `vendor-service`

```java
// rfq-bidding-service/client/VendorClient.java
@FeignClient(name = "vendor-service", url = "${VENDOR_SERVICE_URL}")
public interface VendorClient {
    @GetMapping("/api/vendors/{vendorId}")
    VendorResponse getVendor(@PathVariable Long vendorId);
}
```

When a bid is submitted, the service calls the vendor-service to get the vendor's name and email, embeds them in the Kafka event, then publishes. If vendor-service is down, the bid submission fails gracefully (circuit breaker kicks in with fallback defaults).

**Resilience4j circuit breaker pattern:**
If vendor-service fails repeatedly, the circuit "opens" — subsequent calls short-circuit immediately with a fallback response instead of waiting for a timeout. This prevents cascading failures.

### Pattern 2: Asynchronous Kafka Events

Used when the caller does _not_ need a response — it just needs to inform other services that something happened.

**Example:** After a delivery is marked Complete, `delivery-invoice-service` publishes a `delivery.completed` event. Both `scoring-service` and `notification-service` consume it independently, at their own pace, with no dependency on each other.

This is covered in detail in [05-event-driven-design.md](05-event-driven-design.md).

---

## Database Isolation (One DB Per Service)

Each service owns a dedicated PostgreSQL database instance:

| Service | Database | Port |
|---|---|---|
| auth-service | authdb | 5432 |
| vendor-service | vendordb | 5433 |
| rfq-bidding-service | rfqdb | 5434 |
| procurement-service | procurementdb | 5435 |
| delivery-invoice-service | deliverydb | 5436 |
| scoring-service | scoringdb | 5437 |
| inventory-service | inventorydb | 5438 |
| notification-service | notificationdb | 5439 |

**Why separate databases?**

In a microservices system, if services share a database:
- One service's schema change can break another service's queries.
- One service's heavy queries slow down another service's DB operations.
- You can't independently scale the database layer of a hot service.
- Services become tightly coupled at the data layer, defeating the purpose of microservices.

The downside is that **joins across services are impossible** at the DB level. Instead, services fetch related data via API calls or embed denormalised data in events. This is a deliberate trade-off in favour of isolation.

---

## Redis: One Instance Per Service

Each service also has its own Redis instance (ports 6380–6387). There is also a shared Redis on port 6379 used by the API gateway for rate limiting.

**Why not share one Redis?**
- Namespace collisions: two services could accidentally use the same cache key.
- A runaway service with memory leaks can't exhaust the shared Redis pool and starve others.
- Each service can have independent eviction policies and memory limits (64MB + LRU in this setup).

**Configuration for all service Redis instances:**
```yaml
maxmemory 67108864      # 64MB
maxmemory-policy allkeys-lru   # Evict least recently used keys when full
```

---

## The analytics-service Exception

`analytics-service` is special — it has **no database of its own**. Instead, it acts as a **read aggregator**: it calls vendor-service, rfq-bidding-service, and procurement-service via HTTP, aggregates the responses, caches the result in Redis, and returns a dashboard summary.

**Why?** Analytics data is by nature cross-cutting — it needs to see data from multiple domains. Rather than duplicating data into an analytics database (and worrying about sync), the service simply fetches fresh data and caches it. The Redis TTL means it's near-real-time without hammering downstream services on every page load.

**The tradeoff:** If any downstream service is down, some analytics will be unavailable. Since analytics is non-critical (you can live without a dashboard for a few minutes), this is acceptable.

---

## Deployment Topology

```
docker-compose.yml defines a single network: procurement-network

Services communicate by container name (Docker DNS):
  auth-service:8081, vendor-service:8082, etc.

External access:
  - frontend → localhost:3000
  - api-gateway → localhost:8080
  - All other services: not exposed to host (internal only)

PostgreSQL ports exposed to host (for development debugging):
  postgres-auth:5432 → localhost:5432
  postgres-vendor:5433 → localhost:5433
  ... etc
```

All service containers are on the same Docker bridge network. The frontend container accesses the gateway at `http://api-gateway:8080`. The gateway routes internally by container DNS name, never by localhost.

---

## What This Architecture Cannot Do (Honest Trade-offs)

| Limitation | Reason | Mitigation |
|---|---|---|
| No cross-service DB joins | Each service owns its own DB | API calls + denormalised event data |
| No distributed transactions | No saga/2PC implementation | Eventual consistency via Kafka events |
| Schema migrations are manual | `ddl-auto: update` not Flyway | Fine for dev; needs Flyway in production |
| No service discovery | Hardcoded URLs in docker-compose env vars | Fine for fixed deployments; would need Consul/Kubernetes DNS for dynamic |
| Increased latency on complex pages | Multiple round-trips to aggregate data | Redis caching on analytics-service |

These are known trade-offs, not bugs. The architecture is well-suited for the current stage of the project.
