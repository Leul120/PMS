# Procurement Management System (PMS)

> A production-grade, cloud-native procurement platform built on a microservices architecture. Designed to digitize and automate the full procurement lifecycle — from vendor onboarding and RFQ/RFP management through bid evaluation, purchase order approval, delivery tracking, invoice validation, and automated vendor performance scoring.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [System Architecture](#2-system-architecture)
3. [Functional Requirements](#3-functional-requirements)
4. [Non-Functional Requirements](#4-non-functional-requirements)
5. [Microservices Reference](#5-microservices-reference)
6. [Technology Stack](#6-technology-stack)
7. [Security Model](#7-security-model)
8. [Data Architecture](#8-data-architecture)
9. [Event-Driven Communication](#9-event-driven-communication)
10. [Vendor Scoring Engine](#10-vendor-scoring-engine)
11. [Approval Workflow](#11-approval-workflow)
12. [3-Way Invoice Matching](#12-3-way-invoice-matching)
13. [Caching & Resilience](#13-caching--resilience)
14. [Frontend Application](#14-frontend-application)
15. [API Reference](#15-api-reference)
16. [Deployment](#16-deployment)
17. [Configuration Reference](#17-configuration-reference)
18. [Observability](#18-observability)
19. [Known Limitations & Future Work](#19-known-limitations--future-work)

---

## 1. Project Overview

Manual procurement processes are slow, opaque, and error-prone. This system replaces spreadsheets and email chains with a structured, auditable digital workflow that enforces business rules automatically.

**Core value propositions:**

- Every procurement action is traceable — who did what, when, and why
- Vendor selection is objective — driven by weighted KPI scores, not relationships
- Financial controls are enforced at the system level — no PO gets approved without the right authority
- Invoice fraud is reduced — automated 3-way matching catches discrepancies before payment
- Compliance is built in — audit logs, role-based access, and vendor verification gates

**Roles supported:**

| Role | Responsibilities |
|------|-----------------|
| `ADMIN` | Full system access, user management, role assignment, system settings |
| `PROCUREMENT_OFFICER` | Create RFQs, evaluate bids, raise purchase orders |
| `MANAGER` | Approve POs up to $49,999 |
| `DIRECTOR` | Approve POs $50,000 and above |
| `VENDOR` | Self-register, browse RFQs, submit bids, log deliveries, submit invoices |
| `AUDITOR` | Read-only access to all transactions, audit logs, compliance reports |

---

## 2. System Architecture

The system is composed of 10 independently deployable services communicating over both synchronous REST and asynchronous Kafka channels.

```
                        ┌─────────────────────────────────┐
                        │         Next.js Frontend         │
                        │    (React 18, TypeScript, SSR)   │
                        └────────────────┬────────────────┘
                                         │ HTTPS
                        ┌────────────────▼────────────────┐
                        │           API Gateway            │
                        │  Spring Cloud Gateway  :8080     │
                        │  JWT validation · Rate limiting  │
                        │  Circuit breaker · CORS          │
                        └──┬──┬──┬──┬──┬──┬──┬──┬──┬─────┘
                           │  │  │  │  │  │  │  │  │
          ┌────────────────┘  │  │  │  │  │  │  │  └──────────────────┐
          │         ┌─────────┘  │  │  │  │  │  └──────────┐          │
          │         │      ┌─────┘  │  │  │  └──────┐      │          │
          ▼         ▼      ▼        ▼  │  ▼         ▼      ▼          ▼
       :8081     :8082   :8083    :8084 │ :8085    :8086  :8087      :8088/:8089
      Auth      Vendor   RFQ    Procure │Delivery Scoring Analytics  Inventory/
     Service   Service  Bidding  ment   │Invoice  Service  Service   Notification
                        Service Service │Service
                                        │
                        ┌───────────────▼──────────────────┐
                        │         Apache Kafka              │
                        │   Event bus for async workflows   │
                        └──────────────────────────────────┘
```

**Communication patterns:**

- **Synchronous (REST + WebClient):** Auth validation, vendor lookups, category resolution, cross-service data enrichment. All inter-service REST calls go through Resilience4j circuit breakers.
- **Asynchronous (Kafka):** Domain events (bid submitted, PO approved, delivery completed, score updated). Producers use idempotent writes with `acks=all`. Consumers use `@RetryableTopic` with exponential backoff and dead-letter topics.

---

## 3. Functional Requirements

### 3.1 Authentication & User Management

- Users self-register with the `VENDOR` role only. All other roles (`ADMIN`, `PROCUREMENT_OFFICER`, `MANAGER`, `DIRECTOR`, `AUDITOR`) are assigned by an administrator.
- Login returns a signed JWT (HS256 in Docker/local, RS256 in Kubernetes) valid for 8 hours.
- Accounts are automatically locked after 5 consecutive failed login attempts. Admins can unlock accounts manually.
- Password reset via time-limited email token (60-minute expiry by default).
- Admins can manage system-wide settings (company name, currency, timezone), notification preferences, and security policies (session timeout, password expiry) — all persisted to the database.
- Full audit log of every authentication event: login, logout, registration, role assignment, account lock/unlock, password reset.

### 3.2 Vendor Management

- Vendors self-register with company name, contact details, tax ID, and category.
- Procurement officers verify vendors before they can participate in bidding. Unverified vendors cannot submit bids.
- Vendor compliance status is tracked (`Pending`, `Verified`, `Suspended`).
- Vendor categories are managed by admins and used to match vendors to relevant RFQs.
- Vendor profiles include performance scores pulled from the scoring service.
- Distributed locking prevents duplicate vendor creation on concurrent requests.
- Vendor data is cached in Redis with cache eviction on updates.

### 3.3 RFQ & Bidding

- Procurement officers create RFQs with title, description, deadline, estimated value, category, and expected quantity.
- On creation, an `rfq.published` Kafka event notifies all relevant parties.
- Vendors browse open RFQs and submit bids with amount, proposal text, and delivery commitment (days).
- Bid submission uses a pessimistic database lock on the RFQ row to prevent race conditions when an RFQ is closing concurrently.
- Bids cannot be submitted after the deadline. RFQs are auto-closed by a scheduled job when their deadline passes.
- Procurement officers evaluate bids after the deadline. Evaluation calculates a weighted score per bid.
- Bids are ranked by total score. The officer awards the winning bid, which automatically rejects all other bids in a single bulk update (no N+1).
- Awarding a bid transitions the RFQ status to `Awarded`.

### 3.4 Purchase Orders

- Purchase orders are created from awarded bids, linking the RFQ, vendor, and agreed amount.
- Multi-level approval routing is enforced automatically based on PO value:
  - Under $10,000 → auto-approved
  - $10,000–$49,999 → requires Manager approval
  - $50,000 and above → requires Director or Admin approval
- On approval, a `po.approved` Kafka event triggers vendor notification and delivery tracking setup.
- POs can be rejected with a reason, which notifies the requesting officer.

### 3.5 Delivery & Invoice Management

- Vendors log deliveries against a PO, recording actual delivery date, quantity delivered, and quality remarks.
- The system calculates delay days automatically (actual date vs. expected date).
- A `delivery.completed` Kafka event triggers the scoring service to update vendor KPIs.
- Vendors submit invoices against a PO with the invoice amount.
- Automated 3-way matching validates the invoice against the PO amount and delivered quantity.
- Discrepancies set the invoice to `Disputed` status and publish an `invoice.discrepancy` event.
- Disputes can be resolved by procurement officers.

### 3.6 Vendor Scoring

- Scores are computed automatically when a `delivery.completed` event is received.
- Four KPIs are tracked per vendor: Timeliness, Quality, Cost Competitiveness, Responsiveness.
- Each KPI is weighted and combined into an overall score (0–100).
- Vendors are classified as Low Risk (≥80), Medium Risk (60–79), or High Risk (<60).
- Score history is persisted — every scoring event creates a new record, enabling trend analysis.
- High-risk and medium-risk transitions trigger compliance alerts via the notification service.
- Scores are cached in Redis and invalidated on each new scoring event.

### 3.7 Analytics & Reporting

- Dashboard overview: total spend, active vendors, open RFQs, pending approvals.
- Spend analysis by vendor, category, and time period.
- Vendor performance rankings with score breakdowns.
- Delivery performance reports (on-time rate, average delay).
- Invoice discrepancy reports.
- Analytics service aggregates data by calling downstream services via WebClient with circuit breaker protection. Results are cached in Redis to avoid repeated cross-service calls.

### 3.8 Inventory Management

- Track inventory items with stock levels, reorder thresholds, and category assignments.
- Inventory is updated when deliveries are completed.
- Low-stock alerts are generated when items fall below reorder thresholds.

### 3.9 Notifications

- In-app notifications are persisted to the database and served via REST API.
- Email notifications are sent asynchronously on a dedicated virtual-thread executor — email failures never crash Kafka consumers.
- Notification types: vendor verified, RFQ published, bid submitted, PO approved, delivery completed, invoice discrepancy, score updated, bid deadline approaching, approval pending.
- All Kafka consumers use `@RetryableTopic` with 3 attempts and exponential backoff. Exhausted messages land in a dead-letter topic and are logged.
- Users can mark notifications as read. Unread count is surfaced in the UI.

### 3.10 Audit Trail

- Every state-changing operation in the auth service is recorded with: action type, entity affected, old value, new value, performing user, and timestamp.
- Auditors can search and filter audit logs by action, entity, or user.
- Audit logs are exportable as CSV directly from the UI.

---

## 4. Non-Functional Requirements

### 4.1 Performance

- API Gateway enforces rate limiting via Redis token bucket — prevents abuse and protects downstream services.
- All services use HikariCP connection pooling (max 20 connections for high-traffic services, 10 for lower-traffic ones) with tuned idle timeout and max lifetime settings.
- Redis caching is applied at the service layer for frequently read, rarely changed data (vendor profiles, user lookups, analytics aggregates). Cache keys are namespaced per service to avoid collisions across the isolated Redis instances.
- The analytics service caches cross-service aggregations to avoid repeated fan-out calls on every dashboard load.
- N+1 query problems are explicitly avoided — bid count aggregation uses a single bulk query (`countBidsByRfqIds`), and bulk bid rejection uses a single `UPDATE` statement.
- Java 21 virtual threads (`spring.threads.virtual.enabled: true`) are enabled on all services, allowing high concurrency on blocking I/O without the overhead of platform thread pools.

### 4.2 Reliability & Fault Tolerance

- Every inter-service REST call is wrapped in a Resilience4j circuit breaker. The default configuration uses a 10-call sliding window, 50% failure threshold, 10-second open state, and 3 half-open probe calls.
- Kafka producers use `acks=all`, `retries=3`, and `enable.idempotence=true` to guarantee at-least-once delivery without duplicates.
- Kafka consumers use `@RetryableTopic` with exponential backoff (1s base, 2× multiplier, 3 attempts). Messages that exhaust retries are routed to a dead-letter topic and logged with full context.
- Services are designed to degrade gracefully — if a downstream service is unavailable, the calling service returns a fallback response rather than propagating the failure.
- Email delivery failures are explicitly non-fatal and never propagate to Kafka consumer threads.

### 4.3 Scalability

- Each microservice is stateless and horizontally scalable. Session state is stored in Redis, not in-process.
- The Kubernetes deployment runs 2 replicas per service by default and supports HPA (Horizontal Pod Autoscaler) for CPU-based scaling.
- Each service has its own isolated PostgreSQL instance (database-per-service pattern), eliminating cross-service database contention and allowing independent scaling of storage.
- Each service has its own isolated Redis instance, preventing cache key collisions and allowing independent memory tuning.
- Kafka consumer groups allow multiple instances of the same service to process events in parallel.

### 4.4 Security

- All API endpoints require a valid JWT except `/api/auth/register` and `/api/auth/login`.
- JWT tokens are signed with HS256 (local/Docker) or RS256 (Kubernetes). In the Kubernetes deployment, only the auth service holds the RSA private key; all other services verify with the public key only — a compromised downstream service cannot forge tokens.
- Passwords are hashed with BCrypt at strength 10.
- Account lockout after 5 failed login attempts with admin-only unlock.
- Role-based access control is enforced at the controller level. The `RequireRole` component in the frontend enforces the same rules client-side.
- CORS is configured at the API Gateway level. All services behind the gateway do not need individual CORS configuration.
- Distributed locking (Redis-backed) prevents race conditions on concurrent writes to the same resource (vendor creation, user updates).
- Kubernetes secrets store sensitive values (JWT keys, DB credentials). They are never hardcoded in application code.

### 4.5 Maintainability

- Each service follows a consistent layered architecture: Controller → Service → Repository, with DTOs at the boundary.
- Cross-cutting concerns (JWT validation, audit logging) are implemented as Spring AOP aspects, keeping business logic clean.
- Infrastructure concerns (caching, locking, HTTP clients) are isolated in an `infrastructure` package within each service.
- All services share the same base configuration structure (`application.yml` with environment variable overrides), making them easy to reason about and configure.
- Docker Compose provides a one-command local environment. Kubernetes manifests with Kustomize provide a one-command production deployment.

### 4.6 Observability

- Spring Boot Actuator is enabled on all services, exposing health, info, and metrics endpoints.
- Structured logging via SLF4J/Logback. Log levels are configurable per environment.
- Audit logs are persisted to the database for compliance and forensic analysis.
- The Kubernetes deployment guide includes ServiceMonitor configuration for Prometheus scraping via `/actuator/prometheus`.
- Dead-letter topic handler logs full event context (topic, partition, offset, payload) for failed message investigation.

### 4.7 Data Integrity

- All write operations use `@Transactional` with appropriate isolation levels.
- Idempotent Kafka producers prevent duplicate event publishing on retries.
- The 3-way matching engine validates invoice amounts and quantities before any payment approval, providing a financial control layer.
- Distributed locks on vendor creation and user updates prevent duplicate records under concurrent load.

---

## 5. Microservices Reference

| Service | Port | Responsibility | Database | Redis |
|---------|------|---------------|----------|-------|
| `api-gateway` | 8080 | Unified entry point, JWT validation, rate limiting, routing, CORS | — | `:6379` (shared) |
| `auth-service` | 8081 | User registration/login, JWT issuance, RBAC, audit logs, password reset, system settings | `authdb` (:5432) | `:6380` |
| `vendor-service` | 8082 | Vendor registration, verification, categories, compliance tracking | `vendordb` (:5433) | `:6381` |
| `rfq-bidding-service` | 8083 | RFQ lifecycle, bid submission, bid evaluation, bid ranking, award | `rfqdb` (:5434) | `:6382` |
| `procurement-service` | 8084 | Purchase order creation, multi-level approval routing | `procurementdb` (:5435) | `:6383` |
| `delivery-invoice-service` | 8085 | Delivery logging, invoice submission, 3-way matching, dispute management | `deliverydb` (:5436) | `:6384` |
| `scoring-service` | 8086 | Weighted KPI scoring, risk classification, score history | `scoringdb` (:5437) | `:6385` |
| `analytics-service` | 8087 | Spend analysis, vendor rankings, dashboard aggregations | Read from downstream services | `:6386` |
| `inventory-service` | 8088 | Inventory tracking, stock levels, reorder alerts | `inventorydb` (:5438) | — |
| `notification-service` | 8089 | In-app and email notifications, Kafka event consumers | `notificationdb` (:5439) | `:6387` |

---

## 6. Technology Stack

### Backend

| Layer | Technology | Version | Notes |
|-------|-----------|---------|-------|
| Language | Java | 21 | Virtual threads enabled system-wide |
| Framework | Spring Boot | 3.x | Web, Data JPA, Security, Actuator |
| API Gateway | Spring Cloud Gateway | — | Reactive, non-blocking |
| ORM | Spring Data JPA / Hibernate | — | PostgreSQL dialect |
| Database | PostgreSQL | 15 | One instance per service |
| Cache | Redis | 7 | One instance per service |
| Message Broker | Apache Kafka | 7.5.0 (Confluent) | With Zookeeper |
| HTTP Client | Spring WebFlux WebClient | — | Non-blocking, with Resilience4j |
| Resilience | Resilience4j | — | Circuit breaker on all inter-service calls |
| Security | Spring Security + JJWT | — | HS256 (local), RS256 (K8s) |
| Build | Maven | 3.8+ | Multi-module, per-service |
| Containerization | Docker | — | Multi-stage builds |
| Orchestration | Kubernetes | 1.24+ | With Kustomize, NGINX Ingress, MetalLB |

### Frontend

| Layer | Technology | Version | Notes |
|-------|-----------|---------|-------|
| Framework | Next.js | 14.2.3 | App Router, SSR/CSR hybrid |
| Language | TypeScript | 5.4 | Strict mode |
| UI Components | Radix UI | — | Accessible primitives |
| Styling | Tailwind CSS | 3.4 | Utility-first |
| Charts | Recharts | 2.12 | Spend and performance dashboards |
| Forms | React Hook Form + Zod | — | Schema-validated forms |
| State | Zustand | 4.5 | Auth store, global state |
| HTTP | Axios | 1.6 | Centralized API client |
| Animations | Framer Motion | 12 | Page transitions |

---

## 7. Security Model

### JWT Authentication Flow

```
Client → POST /api/auth/login
       ← { accessToken, tokenType, userId, email, role }

Client → GET /api/vendors (Authorization: Bearer <token>)
       → API Gateway validates JWT signature + expiry
       → Extracts userId, role, permissions from claims
       → Forwards request to vendor-service with validated identity
       ← Response
```

### Token Claims

```json
{
  "sub": "1",
  "email": "officer@company.com",
  "role": "PROCUREMENT_OFFICER",
  "permissions": ["CREATE_RFQ", "EVALUATE_BID", "CREATE_PO"],
  "iat": 1700000000,
  "exp": 1700028800
}
```

### Kubernetes: RS256 Asymmetric JWT

In the Kubernetes deployment, JWT signing uses RSA-256:

- **Auth service only** holds the RSA private key (mounted from a K8s Secret)
- **All other services** receive only the RSA public key — they can verify tokens but cannot forge them
- A JWKS endpoint (`/.well-known/jwks.json`) supports dynamic key rotation without redeployment

### Account Security

- BCrypt password hashing (strength 10)
- Account lockout after 5 failed attempts (tracked per user, reset on successful login)
- Admin-only account unlock with audit trail
- Password reset via time-limited token (60 minutes, configurable)
- Session timeout configurable via system settings (minimum 15 minutes enforced)

---

## 8. Data Architecture

### Database-per-Service

Each service owns its data exclusively. No service queries another service's database directly. Cross-service data needs are satisfied through:

1. **Synchronous REST calls** for real-time lookups (e.g., vendor name resolution in bid responses)
2. **Kafka events** for eventual consistency (e.g., scoring triggered by delivery completion)
3. **Local denormalization** where appropriate (e.g., vendor name stored in bid response DTO)

### Schema Management

Services use `ddl-auto: update` (auth, scoring) or `ddl-auto: create-drop` (rfq, procurement) in development. Production deployments should use Flyway or Liquibase migrations — this is noted as a future enhancement.

### Connection Pool Configuration (HikariCP)

```yaml
hikari:
  maximum-pool-size: 20      # High-traffic services (auth, rfq, procurement)
  minimum-idle: 5
  connection-timeout: 30000  # 30s — fail fast rather than queue indefinitely
  idle-timeout: 600000       # 10 min
  max-lifetime: 1800000      # 30 min — recycle before PostgreSQL server-side timeout
```

---

## 9. Event-Driven Communication

### Kafka Topics

| Topic | Producer | Consumers | Payload |
|-------|----------|-----------|---------|
| `vendor.verified` | vendor-service | notification-service | vendorId, email, companyName |
| `rfq.published` | rfq-bidding-service | notification-service | rfqId, title, deadline, estimatedValue, categoryId |
| `bid.submitted` | rfq-bidding-service | notification-service, scoring-service | bidId, rfqId, vendorId, bidAmount |
| `bid.deadline.approaching` | rfq-bidding-service | notification-service | rfqId, title, deadline |
| `po.approved` | procurement-service | notification-service, delivery-invoice-service | poId, vendorId, totalAmount, approvedBy |
| `approval.pending` | procurement-service | notification-service | poId, totalAmount, requestedBy |
| `delivery.completed` | delivery-invoice-service | scoring-service, notification-service | deliveryId, poId, vendorId, delayDays, quantityDelivered, qualityRemarks |
| `invoice.discrepancy` | delivery-invoice-service | notification-service | invoiceId, poId, invoiceAmount, expectedAmount, discrepancyReason |
| `score.updated` | scoring-service | notification-service, analytics-service | vendorId, overallScore, riskLevel |

### Producer Configuration

```yaml
kafka:
  producer:
    acks: all                          # Wait for all in-sync replicas
    retries: 3
    properties:
      enable.idempotence: true         # Exactly-once semantics on retries
      max.in.flight.requests.per.connection: 1  # Preserve ordering
```

### Consumer Retry Strategy

```java
@RetryableTopic(
    attempts = "3",
    backoff = @Backoff(delay = 1000, multiplier = 2.0),  // 1s, 2s, 4s
    topicSuffixingStrategy = TopicSuffixingStrategy.SUFFIX_WITH_INDEX_VALUE
)
@KafkaListener(topics = "delivery.completed", groupId = "notification-service-group")
public void handleDeliveryCompleted(Map<String, Object> event) { ... }
```

Failed messages after all retries are routed to a dead-letter topic and logged with full context (topic, partition, offset, payload).

---

## 10. Vendor Scoring Engine

### Formula

```
Overall Score = (Timeliness × 0.35) + (Quality × 0.35) + (Cost × 0.20) + (Responsiveness × 0.10)
```

### KPI Calculations

**Timeliness (35%)** — measures delivery punctuality:
```
Timeliness = max(0, (1 - delayDays / expectedDays) × 100)
```
A vendor delivering on time scores 100. Each day of delay proportionally reduces the score.

**Quality (35%)** — based on delivery quality remarks:
```
Quality = 100 - (deductions for damaged/rejected goods)
```
Deductions are applied based on quality remarks logged at delivery time.

**Cost Competitiveness (20%)** — relative to the lowest bid on the same RFQ:
```
Cost = (lowestBidOnRFQ / vendorBidAmount) × 100
```
The vendor who submitted the lowest bid scores 100. Higher bids score proportionally lower.

**Responsiveness (10%)** — measures bid participation rate:
```
Responsiveness = (bidsSubmittedOnTime / totalRFQsInCategory) × 100
```

### Risk Classification

| Score Range | Risk Level | Action |
|-------------|-----------|--------|
| ≥ 80 | Low Risk | Normal operations |
| 60–79 | Medium Risk | Compliance alert generated, monitor closely |
| < 60 | High Risk | Compliance alert generated, review recommended before new POs |

### Score History

Every scoring event creates a new `VendorScore` record. This enables:
- Trend analysis over time
- Identifying vendors who are improving vs. declining
- Historical audit trail for procurement decisions

---

## 11. Approval Workflow

Purchase orders are routed for approval based on total value. The thresholds are configurable via environment variables.

```
PO Created
    │
    ▼
Amount < $10,000? ──Yes──► Auto-Approved ──► po.approved event ──► Vendor notified
    │
    No
    │
    ▼
Amount < $50,000? ──Yes──► Pending Manager Approval ──► approval.pending event
    │                           │
    │                    Manager approves/rejects
    │                           │
    No                          ▼
    │                    Approved ──► po.approved event
    │                    Rejected ──► Officer notified
    ▼
Pending Director/Admin Approval ──► approval.pending event
    │
Director/Admin approves/rejects
    │
    ▼
Approved ──► po.approved event ──► Vendor notified + Delivery tracking activated
Rejected ──► Officer notified
```

**Configuration:**
```yaml
approval:
  threshold:
    manager: 10000    # POs above this require manager approval
    director: 50000   # POs above this require director/admin approval
```

---

## 12. 3-Way Invoice Matching

The system automatically validates every invoice against three sources of truth before it can be approved for payment.

```
Invoice Submitted
        │
        ▼
┌───────────────────────────────────────────────────────┐
│  Check 1: PO Match                                    │
│  Invoice amount ≈ Purchase Order total amount?        │
│  Tolerance: configurable (default: exact match)       │
└───────────────────────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────────────────────┐
│  Check 2: Delivery Match                              │
│  Invoice quantity ≈ Quantity delivered?               │
└───────────────────────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────────────────────┐
│  Check 3: Quality Check                               │
│  Delivery quality remarks acceptable?                 │
│  No damaged/rejected goods flagged?                   │
└───────────────────────────────────────────────────────┘
        │
   All pass?
   ┌─────┴─────┐
  Yes          No
   │            │
   ▼            ▼
Validated    Disputed
             discrepancyFlag = true
             invoice.discrepancy event published
             Procurement officer notified
             Manual review required
```

---

## 13. Caching & Resilience

### Redis Caching Strategy

Each service has a dedicated Redis instance. This isolation means:
- A cache flush in one service doesn't affect others
- Memory limits are tuned per service workload
- No key namespace collisions

**Cache annotations in use:**

```java
// Read-through cache with sync=true (prevents cache stampede)
@Cacheable(value = "vendors", key = "'vendor-service:vendors:by-id:' + #vendorId", sync = true)

// Cache eviction on write
@CacheEvict(value = "vendors", key = "'vendor-service:vendors:by-id:' + #vendorId")

// Multiple evictions on update
@Caching(evict = {
    @CacheEvict(value = "users", key = "...:#userId")
})
```

**Redis memory configuration (per instance):**
```
maxmemory 64mb
maxmemory-policy allkeys-lru   # Evict least recently used when full
appendonly yes                  # AOF persistence
```

### Distributed Locking

Critical write operations use Redis-backed distributed locks via a custom `@DistributedLock` AOP aspect:

```java
@DistributedLock(key = "'vendor:create:' + #vendor.email", waitTime = 5, leaseTime = 30)
public Vendor createVendor(Vendor vendor) { ... }

@DistributedLock(key = "'user:update:' + #userId", waitTime = 5, leaseTime = 30)
public UserResponse updateUser(Long userId, UpdateUserRequest request) { ... }
```

This prevents duplicate records and lost updates under concurrent load without requiring database-level serializable isolation.

### Circuit Breaker Configuration

```yaml
resilience4j:
  circuitbreaker:
    configs:
      default:
        slidingWindowSize: 10              # Evaluate last 10 calls
        failureRateThreshold: 50           # Open if >50% fail
        waitDurationInOpenState: 10s       # Wait before half-open probe
        permittedNumberOfCallsInHalfOpenState: 3  # Probe calls before closing
    instances:
      authService:
        baseConfig: default
      vendorService:
        baseConfig: default
      rfqService:
        baseConfig: default
```

---

## 14. Frontend Application

### Architecture

The frontend is a Next.js 14 application using the App Router. It communicates exclusively with the API Gateway — no direct service calls.

**Route structure:**

```
/                          Landing page
/login                     Authentication
/dashboard/
  admin/                   Admin dashboard (ADMIN)
  procurement/             Procurement officer dashboard (PROCUREMENT_OFFICER)
  vendor/                  Vendor dashboard (VENDOR)
  auditor/                 Auditor dashboard (AUDITOR, ADMIN)
/vendors/                  Vendor list, profiles, performance scores
/rfq/                      RFQ list, create, bid management
/orders/                   Purchase order list, approval actions
/deliveries/               Delivery tracking
/invoices/                 Invoice submission and status
/inventory/                Inventory management
/analytics/                Spend reports, vendor rankings, charts
/notifications/            Notification center
/users/                    User management (ADMIN only)
/settings/                 System, notification, and security settings
/profile/                  User profile
```

### Role-Based UI

The `RequireRole` component wraps every protected page and redirects unauthorized users. The sidebar dynamically renders navigation items based on the authenticated user's role. Role information is stored in Zustand and derived from the JWT claims returned at login.

### State Management

- **Zustand** (`useAuthStore`): Authenticated user, JWT token, role, helper methods (`hasRole`)
- **React Hook Form + Zod**: All forms use schema validation before submission
- **Local state**: Page-level data fetching with `useEffect` and loading/error states

### API Client

A centralized `api.ts` module exports typed API functions for every service endpoint. Axios interceptors attach the JWT token to every request automatically.

---

## 15. API Reference

All requests go through the API Gateway at `http://localhost:8080`. Include `Authorization: Bearer <token>` on every request except login and register.

### Authentication

#### Register (Vendor self-registration)
```http
POST /api/auth/register
Content-Type: application/json

{
  "fullName": "Jane Smith",
  "email": "jane@techsupplies.com",
  "password": "SecurePass123!",
  "phoneNumber": "+1234567890"
}
```

#### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "admin@procurement.com",
  "password": "admin123"
}
```

Response:
```json
{
  "accessToken": "eyJhbGciOiJIUzUxMiJ9...",
  "tokenType": "Bearer",
  "userId": 1,
  "email": "admin@procurement.com",
  "fullName": "System Administrator",
  "role": "ADMIN"
}
```

#### Get Current User
```http
GET /api/auth/me
Authorization: Bearer <token>
```

#### Request Password Reset
```http
POST /api/auth/forgot-password
Content-Type: application/json

{ "email": "user@company.com" }
```

#### Reset Password with Token
```http
POST /api/auth/reset-password
Content-Type: application/json

{ "token": "<reset-token>", "newPassword": "NewSecurePass123!" }
```

---

### User Management (ADMIN only)

#### List All Users
```http
GET /api/admin/users
Authorization: Bearer <admin-token>
```

#### Assign Role
```http
PUT /api/admin/users/{userId}/role
Authorization: Bearer <admin-token>
Content-Type: application/json

{ "roleName": "PROCUREMENT_OFFICER" }
```

#### Lock / Unlock Account
```http
POST /api/admin/users/{userId}/lock
POST /api/admin/users/{userId}/unlock
Authorization: Bearer <admin-token>
```

#### Get Audit Logs
```http
GET /api/admin/audit-logs
Authorization: Bearer <admin-token>
```

---

### Vendor Management

#### Register Vendor Profile
```http
POST /api/vendors/register
Authorization: Bearer <token>
Content-Type: application/json

{
  "companyName": "Tech Supplies Inc",
  "contactPerson": "Jane Smith",
  "email": "vendor@techsupplies.com",
  "categoryId": 1,
  "phoneNumber": "+1234567890",
  "address": "123 Tech Street",
  "taxId": "TAX123456"
}
```

#### Verify Vendor (PROCUREMENT_OFFICER / ADMIN)
```http
POST /api/vendors/{vendorId}/verify
Authorization: Bearer <token>
```

#### Get All Vendors
```http
GET /api/vendors
Authorization: Bearer <token>
```

#### Get Vendor Categories
```http
GET /api/vendors/categories
Authorization: Bearer <token>
```

---

### RFQ & Bidding

#### Create RFQ
```http
POST /api/rfqs
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "Laptop Procurement Q1 2025",
  "description": "50 laptops for the IT department refresh",
  "deadline": "2025-03-31T23:59:59",
  "estimatedValue": 75000.00,
  "categoryId": 1,
  "expectedQuantity": 50
}
```

#### List RFQs (paginated)
```http
GET /api/rfqs?page=0&size=20
Authorization: Bearer <token>
```

#### Get RFQs by Status
```http
GET /api/rfqs/status/Open
Authorization: Bearer <token>
```

#### Close RFQ
```http
POST /api/rfqs/{rfqId}/close
Authorization: Bearer <token>
```

#### Submit Bid
```http
POST /api/bids
Authorization: Bearer <token>
Content-Type: application/json

{
  "rfqId": 1,
  "vendorId": 3,
  "bidAmount": 68500.00,
  "proposalText": "High-spec laptops with 3-year on-site warranty and next-day replacement.",
  "deliveryDays": 14
}
```

#### Evaluate Bid (calculates weighted score)
```http
POST /api/bids/{bidId}/evaluate
Authorization: Bearer <token>
```

#### Get Ranked Bids for RFQ
```http
GET /api/bids/rfq/{rfqId}/ranked
Authorization: Bearer <token>
```

#### Award Bid
```http
POST /api/bids/{bidId}/award
Authorization: Bearer <token>
```

---

### Purchase Orders

#### Create Purchase Order
```http
POST /api/purchase-orders
Authorization: Bearer <token>
Content-Type: application/json

{
  "rfqId": 1,
  "vendorId": 3,
  "totalAmount": 68500.00,
  "expectedDeliveryDate": "2025-04-15"
}
```

#### Approve PO
```http
POST /api/purchase-orders/{poId}/approve
Authorization: Bearer <token>
```

#### Reject PO
```http
POST /api/purchase-orders/{poId}/reject
Authorization: Bearer <token>
Content-Type: application/json

{ "reason": "Budget not approved for this quarter." }
```

#### Get All Purchase Orders
```http
GET /api/purchase-orders
Authorization: Bearer <token>
```

---

### Delivery & Invoice

#### Log Delivery
```http
POST /api/deliveries
Authorization: Bearer <token>
Content-Type: application/json

{
  "poId": 1,
  "vendorId": 3,
  "expectedDate": "2025-04-15",
  "actualDate": "2025-04-14",
  "quantityDelivered": 50,
  "qualityRemarks": "All units in good condition, packaging intact."
}
```

#### Submit Invoice
```http
POST /api/invoices
Authorization: Bearer <token>
Content-Type: application/json

{
  "poId": 1,
  "vendorId": 3,
  "invoiceAmount": 68500.00
}
```

#### Validate Invoice (3-way match)
```http
POST /api/invoices/{invoiceId}/validate
Authorization: Bearer <token>
Content-Type: application/json

{
  "expectedAmount": 68500.00,
  "expectedQuantity": 50
}
```

#### Get Disputes
```http
GET /api/disputes
Authorization: Bearer <token>
```

#### Resolve Dispute
```http
POST /api/disputes/{disputeId}/resolve
Authorization: Bearer <token>
Content-Type: application/json

{ "resolution": "Vendor issued credit note for the $500 discrepancy." }
```

---

### Vendor Scoring

#### Get Scores for a Vendor
```http
GET /api/scores/vendor/{vendorId}
Authorization: Bearer <token>
```

Response:
```json
{
  "vendorId": 3,
  "overallScore": 84.5,
  "timelinessScore": 92.0,
  "qualityScore": 88.0,
  "costScore": 76.0,
  "responsivenessScore": 90.0,
  "riskLevel": "Low",
  "lastUpdated": "2025-04-15T10:30:00"
}
```

#### Get Vendor Rankings
```http
GET /api/scores/ranking
Authorization: Bearer <token>
```

---

### Analytics & Reporting

#### Dashboard Overview
```http
GET /api/dashboard/overview
Authorization: Bearer <token>
```

#### Spend Report
```http
GET /api/reports/spend
Authorization: Bearer <token>
```

#### Vendor Performance Report
```http
GET /api/reports/vendor-performance
Authorization: Bearer <token>
```

#### Delivery Performance Report
```http
GET /api/reports/delivery-performance
Authorization: Bearer <token>
```

---

### Inventory

#### Get All Inventory Items
```http
GET /api/inventory
Authorization: Bearer <token>
```

#### Create Inventory Item
```http
POST /api/inventory
Authorization: Bearer <token>
Content-Type: application/json

{
  "itemName": "Laptop - Dell XPS 15",
  "sku": "DELL-XPS15-001",
  "quantity": 50,
  "reorderThreshold": 10,
  "categoryId": 1
}
```

---

### Notifications

#### Get My Notifications
```http
GET /api/notifications/user/{userId}
Authorization: Bearer <token>
```

#### Get Unread Notifications
```http
GET /api/notifications/user/{userId}/unread
Authorization: Bearer <token>
```

#### Mark as Read
```http
PUT /api/notifications/{notificationId}/read
Authorization: Bearer <token>
```

---

## 16. Deployment

### Prerequisites

| Tool | Minimum Version |
|------|----------------|
| Java | 21 |
| Maven | 3.8 |
| Docker | 24.x |
| Docker Compose | 2.x |
| Node.js | 18.x (frontend only) |
| kubectl | 1.24+ (Kubernetes only) |

---

### Option A: Docker Compose (Recommended for local/dev)

This starts the full stack: Zookeeper, Kafka, 8 PostgreSQL instances, 9 Redis instances, all 10 microservices, and the Next.js frontend.

```bash
# Clone the repository
git clone <repo-url>
cd PMS

# (Optional) Create a .env file for SMTP and JWT secret
cp .env.example .env
# Edit .env with your values

# Start everything
docker-compose up -d

# Check all containers are healthy
docker-compose ps

# Follow logs for a specific service
docker-compose logs -f auth-service

# Stop everything
docker-compose down
```

**Access points after startup:**

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| API Gateway | http://localhost:8080 |
| Auth Service (direct) | http://localhost:8081 |
| Kafka | localhost:9092 |

**Default seeded accounts** (created by `DataInitializer` on first startup):

| Email | Password | Role |
|-------|----------|------|
| `admin@procurement.com` | `admin123` | ADMIN |
| `officer@procurement.com` | `officer123` | PROCUREMENT_OFFICER |
| `manager@procurement.com` | `manager123` | MANAGER |
| `director@procurement.com` | `director123` | DIRECTOR |
| `auditor@procurement.com` | `auditor123` | AUDITOR |

---

### Option B: Local Development (Infrastructure in Docker, services on JVM)

Run only the infrastructure in Docker and start each service directly on the JVM for faster iteration.

**Step 1 — Start infrastructure:**
```bash
docker-compose up -d zookeeper kafka \
  postgres-auth postgres-vendor postgres-rfq \
  postgres-procurement postgres-delivery postgres-scoring \
  postgres-inventory postgres-notification \
  redis redis-auth redis-vendor redis-rfq \
  redis-procurement redis-delivery redis-scoring \
  redis-analytics redis-notification
```

**Step 2 — Build all services:**
```bash
# From the project root
for service in auth-service vendor-service rfq-bidding-service \
               procurement-service delivery-invoice-service scoring-service \
               analytics-service inventory-service notification-service api-gateway; do
  echo "Building $service..."
  cd $service && mvn clean package -DskipTests -q && cd ..
done
```

**Step 3 — Run services** (each in a separate terminal):
```bash
java -jar auth-service/target/auth-service-*.jar
java -jar vendor-service/target/vendor-service-*.jar
java -jar rfq-bidding-service/target/rfq-bidding-service-*.jar
java -jar procurement-service/target/procurement-service-*.jar
java -jar delivery-invoice-service/target/delivery-invoice-service-*.jar
java -jar scoring-service/target/scoring-service-*.jar
java -jar analytics-service/target/analytics-service-*.jar
java -jar inventory-service/target/inventory-service-*.jar
java -jar notification-service/target/notification-service-*.jar
java -jar api-gateway/target/api-gateway-*.jar
```

**Step 4 — Start the frontend:**
```bash
cd frontend
npm install
npm run dev
# Frontend available at http://localhost:3000
```

---

### Option C: Kubernetes

The `k8s/` directory contains complete manifests for a production-grade Kubernetes deployment with RS256 JWT, NGINX Ingress, MetalLB, and Kustomize.

**Step 1 — Generate RSA keys for JWT:**
```bash
openssl genrsa -out jwt-private.pem 2048
openssl rsa -in jwt-private.pem -pubout -out jwt-public.pem
```

**Step 2 — Update `k8s/secrets.yaml`** with base64-encoded keys:
```bash
openssl base64 -A -in jwt-private.pem
openssl base64 -A -in jwt-public.pem
```

**Step 3 — Deploy with Kustomize:**
```bash
kubectl apply -k k8s/
```

**Step 4 — Verify:**
```bash
kubectl get pods -n procurement
kubectl get svc -n procurement
kubectl get ingress -n procurement
```

**Step 5 — Access:**
```bash
# Port-forward for local testing
kubectl port-forward svc/api-gateway 8080:80 -n procurement

# Or add to /etc/hosts and use ingress
echo "127.0.0.1 api.procurement.local" >> /etc/hosts
```

**Scaling:**
```bash
# Manual scale
kubectl scale deployment vendor-service --replicas=3 -n procurement

# Auto-scale based on CPU
kubectl autoscale deployment auth-service --min=2 --max=5 --cpu-percent=70 -n procurement
```

**Rolling updates:**
```bash
kubectl set image deployment/auth-service \
  auth-service=procurement/auth-service:v2.0 -n procurement
kubectl rollout status deployment/auth-service -n procurement
# Rollback if needed
kubectl rollout undo deployment/auth-service -n procurement
```

---

## 17. Configuration Reference

### Environment Variables

All services support the following environment variables. Defaults are suitable for local development.

| Variable | Description | Default |
|----------|-------------|---------|
| `JWT_SECRET` | JWT signing secret (HS256). Must be ≥32 chars. | `procurement-default-secret-key-change-in-production-min32chars` |
| `JWT_EXPIRATION` | Token validity in milliseconds | `28800000` (8 hours) |
| `SPRING_DATASOURCE_URL` | PostgreSQL JDBC URL | Per-service localhost URL |
| `SPRING_DATASOURCE_USERNAME` | Database username | `postgres` |
| `SPRING_DATASOURCE_PASSWORD` | Database password | `secret` |
| `SPRING_KAFKA_BOOTSTRAP_SERVERS` | Kafka broker address | `localhost:9092` |
| `REDIS_HOST` | Redis hostname | `localhost` |
| `REDIS_PORT` | Redis port | `6379` |
| `SMTP_HOST` | SMTP server hostname | `smtp.gmail.com` |
| `SMTP_PORT` | SMTP server port | `587` |
| `SMTP_USERNAME` | SMTP authentication username | _(empty — disables email)_ |
| `SMTP_PASSWORD` | SMTP authentication password | _(empty — disables email)_ |
| `FRONTEND_URL` | Frontend base URL for password reset links | `http://localhost:3000` |
| `AUTH_SERVICE_URL` | Auth service base URL (inter-service) | `http://localhost:8081` |
| `VENDOR_SERVICE_URL` | Vendor service base URL | `http://localhost:8082` |
| `RFQ_SERVICE_URL` | RFQ service base URL | `http://localhost:8083` |
| `PROCUREMENT_SERVICE_URL` | Procurement service base URL | `http://localhost:8084` |
| `DELIVERY_INVOICE_SERVICE_URL` | Delivery/invoice service base URL | `http://localhost:8085` |
| `SCORING_SERVICE_URL` | Scoring service base URL | `http://localhost:8086` |
| `ANALYTICS_SERVICE_URL` | Analytics service base URL | `http://localhost:8087` |
| `INVENTORY_SERVICE_URL` | Inventory service base URL | `http://localhost:8088` |
| `NOTIFICATION_SERVICE_URL` | Notification service base URL | `http://localhost:8089` |

### Scoring Weights (scoring-service)

```yaml
scoring:
  weights:
    timeliness: 0.35      # 35%
    quality: 0.35         # 35%
    cost: 0.20            # 20%
    responsiveness: 0.10  # 10%
```

### Approval Thresholds (procurement-service)

```yaml
approval:
  threshold:
    manager: 10000    # USD — POs above this need manager approval
    director: 50000   # USD — POs above this need director/admin approval
```

### Password Reset Token Expiry (auth-service)

```yaml
app:
  password-reset:
    token-expiry-minutes: 60
```

---

## 18. Observability

### Health Checks

Every service exposes Spring Boot Actuator endpoints:

```bash
# Service health
GET http://localhost:{port}/actuator/health

# Application info
GET http://localhost:{port}/actuator/info

# Metrics (Prometheus format)
GET http://localhost:{port}/actuator/prometheus
```

### Logging

Log levels are configurable per environment:

```yaml
logging:
  level:
    com.procurement: DEBUG        # Application code
    org.springframework.security: DEBUG  # Security events (auth-service)
    org.springframework.cloud.gateway: DEBUG  # Routing (api-gateway)
```

In production, set `com.procurement` to `INFO` and disable `show-sql`.

### Kubernetes Monitoring Stack (Recommended)

```
Prometheus  ──scrapes──►  /actuator/prometheus  (all services)
     │
     └──feeds──►  Grafana  (dashboards)

Kafka       ──metrics──►  JMX Exporter  ──►  Prometheus

Application logs  ──►  Logstash  ──►  Elasticsearch  ──►  Kibana
```

**Example ServiceMonitor for Prometheus:**
```yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: procurement-metrics
  namespace: procurement
spec:
  selector:
    matchLabels:
      app: auth-service
  endpoints:
    - port: metrics
      path: /actuator/prometheus
```

### Dead-Letter Topic Monitoring

Failed Kafka messages land in topics suffixed with `-dlt`. Monitor these topics to catch processing failures:

```bash
# List DLT topics
kafka-topics.sh --bootstrap-server localhost:9092 --list | grep dlt

# Consume from a DLT
kafka-console-consumer.sh \
  --bootstrap-server localhost:9092 \
  --topic delivery.completed-dlt-0 \
  --from-beginning
```

---

## 19. Known Limitations & Future Work

### Current Limitations

- **Schema migrations**: Services use `ddl-auto: create-drop` or `update` in development. Production deployments need Flyway or Liquibase for controlled schema evolution.
- **Single Kafka broker**: The current setup runs a single Kafka broker with `replication.factor=1`. This is not fault-tolerant. Production requires a minimum 3-broker cluster with `replication.factor=3`.
- **No service mesh**: Inter-service communication is plain HTTP. mTLS (via Istio or Linkerd) would add transport-level security and observability.
- **Analytics aggregation**: The analytics service calls downstream services on each request (with Redis caching). A proper CQRS read model or data warehouse would be more scalable at high volume.
- **No WebSocket support**: Notifications are polled by the frontend. Real-time push via WebSocket or Server-Sent Events would improve UX.
- **Email configuration**: SMTP credentials must be provided via environment variables. If not configured, email notifications are silently skipped — in-app notifications still work.

### Planned Enhancements

- [ ] Flyway database migrations for all services
- [ ] Kafka cluster with 3 brokers and topic replication
- [ ] WebSocket-based real-time notifications
- [ ] Distributed tracing with OpenTelemetry + Jaeger
- [ ] ERP system integration (SAP, Oracle) via adapter services
- [ ] Multi-tenancy support for SaaS deployment
- [ ] Mobile application (React Native)
- [ ] ML-based vendor risk prediction using historical score data
- [ ] Helm chart for simplified Kubernetes deployment
- [ ] Automated integration test suite with Testcontainers
- [ ] API versioning strategy (`/api/v1/`, `/api/v2/`)
- [ ] GraphQL gateway for flexible frontend queries

---

## Project Structure

```
PMS/
├── api-gateway/                  Spring Cloud Gateway — routing, JWT, rate limiting
├── auth-service/                 Authentication, RBAC, audit logs, user management
├── vendor-service/               Vendor registration, verification, categories
├── rfq-bidding-service/          RFQ lifecycle, bid submission, evaluation, award
├── procurement-service/          Purchase orders, multi-level approval
├── delivery-invoice-service/     Delivery tracking, invoice validation, 3-way match
├── scoring-service/              Weighted KPI scoring, risk classification
├── analytics-service/            Spend reports, dashboards, vendor rankings
├── inventory-service/            Inventory tracking, stock management
├── notification-service/         In-app + email notifications, Kafka consumers
├── frontend/                     Next.js 14 frontend application
│   ├── app/                      App Router pages (per role dashboards)
│   ├── components/               Shared UI components
│   ├── lib/                      API client, auth store, utilities
│   └── hooks/                    Custom React hooks
├── k8s/                          Kubernetes manifests (Kustomize)
│   ├── kustomization.yaml
│   ├── secrets.yaml              JWT keys, DB credentials
│   ├── configmap.yaml            Service URLs, Kafka config
│   ├── postgres-*.yaml           6 PostgreSQL StatefulSets
│   ├── kafka.yaml                Kafka + Zookeeper
│   ├── *-service.yaml            Per-service Deployment + Service
│   └── ingress.yaml              NGINX Ingress rules
├── scripts/                      Utility scripts
├── docker-compose.yml            Full local stack
└── README.md                     This file
```

---

## License

This project was developed as a Final Year Project. It is intended for educational and demonstration purposes.

---

*Built with Java 21, Spring Boot 3, Next.js 14, Apache Kafka, PostgreSQL, and Redis.*
