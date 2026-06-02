# ProcurePro — Procurement Management System

> A cloud-native, multi-tenant procurement platform built on a microservices architecture. Automates the full procurement lifecycle — from vendor onboarding and RFQ management through bid evaluation, purchase order approval, delivery tracking, invoice validation, and automated vendor performance scoring.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [System Architecture](#2-system-architecture)
3. [Functional Capabilities](#3-functional-capabilities)
4. [Non-Functional Design](#4-non-functional-design)
5. [Microservices Reference](#5-microservices-reference)
6. [Technology Stack](#6-technology-stack)
7. [Security Model](#7-security-model)
8. [Multi-Tenancy](#8-multi-tenancy)
9. [Data Architecture](#9-data-architecture)
10. [Event-Driven Communication](#10-event-driven-communication)
11. [Vendor Scoring Engine](#11-vendor-scoring-engine)
12. [Approval Workflows](#12-approval-workflows)
13. [3-Way Invoice Matching](#13-3-way-invoice-matching)
14. [Caching & Resilience](#14-caching--resilience)
15. [Frontend Application](#15-frontend-application)
16. [API Reference](#16-api-reference)
17. [Deployment](#17-deployment)
18. [Configuration Reference](#18-configuration-reference)
19. [Observability](#19-observability)
20. [Known Limitations & Future Work](#20-known-limitations--future-work)
21. [Project Structure](#21-project-structure)

---

## 1. Project Overview

Manual procurement is slow, opaque, and error-prone. This system replaces spreadsheets and email chains with a structured, auditable digital workflow that enforces business rules automatically.

**Core value propositions:**

- Every procurement action is traceable — who did what, when, and why
- Vendor selection is objective — driven by weighted KPI scores, not relationships
- Financial controls are enforced at the system level — no PO gets approved without the right authority
- Invoice fraud is reduced — automated 3-way matching catches discrepancies before payment
- Compliance is built in — audit logs, role-based access, and vendor verification gates
- Multi-tenant SaaS model — multiple independent organisations share one deployment with full data isolation

**Roles:**

| Role | Responsibilities |
|------|-----------------|
| `SUPER_ADMIN` | Cross-tenant access; creates and manages organisations (tenants), assigns admins |
| `ADMIN` | Full access within their organisation; user management, role assignment, system settings |
| `OFFICER` | Creates RFQs, evaluates bids, raises purchase orders, manages vendors |
| `MANAGER` | Approves purchase orders and purchase requisitions |
| `DIRECTOR` | Senior approval authority; analytics and oversight access |
| `VENDOR` | Self-registers, browses RFQs, submits bids, tracks deliveries, submits invoices |
| `AUDITOR` | Read-only access to all transactions, audit logs, and compliance reports |

---

## 2. System Architecture

Ten independently deployable services communicate over synchronous REST and asynchronous Kafka channels.

```
                        ┌──────────────────────────────────┐
                        │        Next.js Frontend           │
                        │   (React 18, TypeScript, :3000)   │
                        └───────────────┬──────────────────┘
                                        │ HTTP
                        ┌───────────────▼──────────────────┐
                        │          API Gateway              │
                        │  Spring Cloud Gateway  :8080      │
                        │  JWT validation · Rate limiting   │
                        │  Route-based proxying · CORS      │
                        └──┬──┬──┬──┬──┬──┬──┬──┬──┬───────┘
                           │  │  │  │  │  │  │  │  │
           ┌───────────────┘  │  │  │  │  │  │  │  └─────────────────┐
           │         ┌────────┘  │  │  │  │  │  └──────────┐         │
           │         │      ┌────┘  │  │  │  └──────┐      │         │
           ▼         ▼      ▼       ▼  │  ▼         ▼      ▼         ▼
        :8081     :8082   :8083   :8084 │ :8085   :8086   :8087   :8088/:8089
       Auth      Vendor   RFQ   Procure │Delivery Scoring Analytics Inventory/
      Service   Service  Bidding  ment  │Invoice  Service  Service  Notification
                         Service Service│Service
                                        │
                         ┌──────────────▼──────────────────┐
                         │         Apache Kafka             │
                         │  Async event bus for workflows   │
                         └─────────────────────────────────┘
```

**Communication patterns:**

- **Synchronous (REST via Feign / WebClient):** Auth validation, vendor lookups, cross-service data enrichment. All inter-service REST calls are wrapped in Resilience4j circuit breakers.
- **Asynchronous (Kafka):** Domain events (bid submitted, PO approved, delivery completed, score updated). Producers use idempotent writes (`acks=all`, `enable.idempotence=true`). Consumers use `@RetryableTopic` with exponential backoff and dead-letter topics.

---

## 3. Functional Capabilities

### 3.1 Authentication & User Management

- Vendor self-registration with admin approval gate — vendors are created with `accountLocked=true` and `PENDING_APPROVAL` status; they cannot log in until an admin approves them.
- All other roles (`ADMIN`, `OFFICER`, `MANAGER`, `DIRECTOR`, `AUDITOR`) are created and assigned by an admin.
- Login returns a signed JWT (HS256) valid for 8 hours containing `userId`, `email`, `role`, `permissions`, and `tenantId` claims.
- Accounts are automatically locked after 5 consecutive failed login attempts. Admins unlock manually.
- Password reset via time-limited email token. Change-password flow for first-login and self-service.
- `mustChangePassword` flag: admin-created users are forced to change password on first login.
- Tenant switching: users belonging to multiple organisations can switch between them; a new JWT is issued with the target `tenantId`.
- Full audit log of every authentication event: login, logout, registration, role changes, account lock/unlock, password reset.
- System settings (company name, currency, timezone), notification preferences, and security policies (session timeout, password expiry) are configurable per organisation and persisted to the database.

### 3.2 Vendor Management

- Vendors self-register with company name, contact details, tax ID, and category.
- Officers verify vendors before they can participate in bidding (`complianceStatus = Verified`).
- Vendor compliance status: `Pending → Verified → Suspended`.
- Guard on deactivation: system warns if the vendor has open purchase orders before deactivating.
- **Document management:** vendors upload compliance documents (PDF/PNG/JPG/DOCX, max 10 MB). Files are stored on disk (`/app/uploads/vendors/{vendorId}/{uuid}.ext`). Downloads require a valid JWT — files are not publicly accessible.
- Vendor performance scores pulled from the scoring service are visible on vendor profiles.
- Cache invalidation on update/verify/status change.

### 3.3 Purchase Requisitions

- Any user can create a purchase requisition with line items, estimated budget, and business justification.
- Multi-level approval workflow: `DRAFT → SUBMITTED → APPROVED / REJECTED`.
- Immutable `ApprovalHistory` records every approver decision with comments and timestamp.
- OFFICER and ADMIN can convert an approved requisition directly into an RFQ or purchase order.
- Low-stock inventory items have a "Reorder" shortcut that pre-fills a new requisition.

### 3.4 RFQ & Bidding

- Officers create RFQs with title, description, deadline, estimated value, category, and expected quantity.
- On creation, an `rfq.published` Kafka event notifies all relevant parties.
- Vendors browse open RFQs and submit bids with amount, proposal text, and delivery commitment (days).
- Bids cannot be submitted after the deadline. A `@Scheduled` cron job closes RFQs every 5 minutes when their deadline passes.
- Officers evaluate bids: the scoring service provides each vendor's historical performance KPIs; a composite `totalScore` is calculated per bid.
- Bids are ranked by `totalScore`. The officer awards the winning bid; the RFQ status transitions to `Awarded`.
- Vendors can view their own bids and see a congratulations banner for awarded bids.

### 3.5 Purchase Orders

- Purchase orders are created from awarded bids, linking the RFQ, vendor, and agreed amount.
- Approval required from MANAGER, DIRECTOR, or ADMIN before a PO becomes active.
- On approval, a `po.approved` Kafka event triggers vendor email notification with PO details.
- POs can be rejected with a reason. Officers receive notification.
- Status cascade: when a delivery is marked complete, the linked PO status updates to "Delivered" synchronously.

### 3.6 Delivery & Invoice Management

- Officers record deliveries against a PO: actual date, quantity, quality remarks, issue notes.
- Delay days are tracked (actual vs. expected delivery date).
- A `delivery.completed` Kafka event updates vendor KPIs and triggers late-delivery email alerts (> 7 days late).
- Vendors submit invoices against a PO with the invoice amount.
- Automated 3-way matching validates invoice against PO amount and delivered quantity.
- Discrepancies set invoice to `Disputed` status and publish an `invoice.discrepancy` event.
- Officers/admins with `disputes:resolve` permission can resolve disputes with a resolution note.

### 3.7 Vendor Scoring

- Scores are updated automatically on `delivery.completed`, `bid.submitted`, and `invoice.discrepancy` Kafka events.
- Four KPIs tracked: on-time delivery rate, quality average, price competitiveness, compliance.
- Weighted composite score (0–100) and risk classification: `LOW / MEDIUM / HIGH`.
- Score history is persisted — every scoring event appends a new record, enabling trend analysis.
- `POST /api/scores/vendor/{id}/performance` returns detailed KPI breakdown used during bid evaluation.
- Manual recalculation available: per-vendor and batch (`recalculate-all`).

### 3.8 Analytics & Reporting

- Dashboard overview: total spend, active vendors, open RFQs, pending approvals, verified vendor count.
- Spend analysis: total spend, spend by vendor (top 10), spend by status.
- Vendor compliance report: verified %, pending %, inactive %, vendors at risk.
- Vendor comparison: side-by-side comparison of selected vendors by score, orders, and spend.
- User activity feed: recent RFQs, POs, and vendors for the logged-in user.
- Analytics service aggregates data by calling downstream services via WebClient, caches results in Redis (5-minute TTL). No dedicated database.
- **CSV export**: OFFICER, DIRECTOR, ADMIN, AUDITOR (all users with `reports:view` permission) can export purchase orders and RFQs as CSV.

### 3.9 Inventory Management

- Track inventory items with item code, quantity, min/max stock levels, unit, location, and category.
- Stock status calculated at the entity level: `critical` (qty ≤ 0), `low` (qty ≤ minStock), `normal`.
- Stock adjustment endpoint: add or subtract quantity by delta.
- `GET /api/inventory/low-stock` returns items below their minimum threshold.
- Low-stock items in the UI have a "Reorder" button that pre-fills a purchase requisition.

### 3.10 Notifications

- In-app notifications persisted to the database, served via REST.
- Email notifications sent asynchronously (`@Async`) so SMTP failures never block Kafka consumer threads.
- Events that trigger notifications: `vendor.verified`, `rfq.published`, `bid.submitted`, `po.approved`, `delivery.completed`, `invoice.discrepancy`.
- Late delivery alert email (> 7 days) sent to the admin email embedded in the delivery event.
- All Kafka consumers use `@RetryableTopic` with 3 attempts and exponential backoff (1s, 2s, 4s). Exhausted messages land in a dead-letter topic.
- SMTP credentials must be provided via `SMTP_USERNAME` / `SMTP_PASSWORD` env vars. In-app notifications work regardless.

### 3.11 Audit Trail

- Every state-changing auth operation is recorded with: action type, user, tenant, IP address, and timestamp.
- AUDITOR role can query and filter audit logs via `GET /api/admin/audit-logs`.

---

## 4. Non-Functional Design

### 4.1 Performance

- API Gateway enforces rate limiting via Redis token bucket at 5 levels: IP, user, tenant, API key, and per-user-per-endpoint.
- Redis caching at the service layer for vendor profiles, user lookups, and analytics aggregates. All keys are tenant-prefixed to prevent cross-tenant cache hits.
- Analytics service caches cross-service aggregations (5–10 min TTL) to avoid fan-out calls on every dashboard load.
- Database indexes on `(tenant_id)`, `(tenant_id, status)`, and domain-specific FK columns on every entity.
- Client-side vendor name map (`Map<vendorId, companyName>`) prevents N+1 API calls when rendering tables with vendor IDs.

### 4.2 Reliability & Fault Tolerance

- Every inter-service REST call is wrapped in a Resilience4j circuit breaker (10-call sliding window, 50% failure threshold, 10s open state).
- Kafka producers: `acks=all`, `retries=3`, `enable.idempotence=true` — at-least-once delivery without duplicates.
- Kafka consumers: `@RetryableTopic`, exponential backoff, dead-letter topics. Failed messages are logged with full context.
- Services degrade gracefully — scoring fallback defaults allow bid evaluation even when the scoring service is temporarily unavailable.
- Email delivery failures are non-fatal and never propagate to Kafka consumer threads.

### 4.3 Scalability

- Each microservice is stateless and horizontally scalable. No in-process session state.
- Database-per-service pattern eliminates cross-service database contention and allows independent storage scaling.
- Redis-per-service eliminates cache key collisions and allows independent memory tuning.
- Kafka consumer groups allow multiple instances of the same service to process events in parallel.
- Kubernetes manifests included with `replicas: 2` default and HPA support.

### 4.4 Security

- All endpoints require a valid JWT except `POST /api/auth/login`, `POST /api/auth/register`, `POST /api/auth/forgot-password`, and `POST /api/auth/reset-password`.
- Multi-tenancy enforced cryptographically: `tenantId` is embedded in the signed JWT — it cannot be spoofed. No `X-Tenant-ID` header fallback anywhere.
- Passwords hashed with BCrypt (strength 10). Account lockout after 5 failed attempts.
- Vendor approval gate: `VENDOR` accounts are created locked and require admin sign-off before first login.
- CORS at the API Gateway level: explicit origin allowlist (`allowCredentials=true`). Internal services use `allowCredentials=false` with explicit header allowlists.
- Distributed locking (Redisson) prevents race conditions on concurrent user/vendor updates.
- Uploaded files stored with UUID filenames — prevents path traversal and overwrite attacks. Download requires valid JWT and appropriate role.

### 4.5 Data Integrity

- All write operations use `@Transactional`.
- Idempotent Kafka producers prevent duplicate event publishing on retries.
- Optimistic locking (`@Version` on RFQ, Bid, PurchaseOrder, Vendor) prevents lost updates under concurrent edits.
- Unique constraints on `(email, tenant_id)` across User and Vendor tables.
- `BigDecimal` used for all monetary amounts — no floating-point rounding errors.

---

## 5. Microservices Reference

| Service | Port | Responsibility | Database | Redis |
|---------|------|---------------|----------|-------|
| `api-gateway` | 8080 | Unified entry point, JWT validation, rate limiting, routing, CORS | — | `:6379` (shared, rate limit) |
| `auth-service` | 8081 | Login, JWT issuance, user/tenant management, RBAC, audit logs, password reset | `authdb` (:5432) | `:6380` |
| `vendor-service` | 8082 | Vendor registration, verification, categories, document uploads, compliance | `vendordb` (:5433) | `:6381` |
| `rfq-bidding-service` | 8083 | RFQ lifecycle, bid submission, bid evaluation, bid ranking, award | `rfqdb` (:5434) | `:6382` |
| `procurement-service` | 8084 | Purchase requisitions, purchase orders, multi-level approval | `procurementdb` (:5435) | `:6383` |
| `delivery-invoice-service` | 8085 | Delivery logging, invoice submission, 3-way matching, dispute management | `deliverydb` (:5436) | `:6384` |
| `scoring-service` | 8086 | Weighted KPI scoring, risk classification, score history, performance API | `scoringdb` (:5437) | `:6385` |
| `analytics-service` | 8087 | Spend analysis, vendor rankings, compliance reports, dashboard aggregation | — (Redis only) | `:6386` |
| `inventory-service` | 8088 | Inventory tracking, stock levels, stock adjustment, low-stock alerts | `inventorydb` (:5438) | — |
| `notification-service` | 8089 | In-app and email notifications, Kafka event consumers for all 6 topics | `notificationdb` (:5439) | `:6387` |

---

## 6. Technology Stack

### Backend

| Layer | Technology | Notes |
|-------|-----------|-------|
| Language | Java 21 | |
| Framework | Spring Boot 3.2 | Web, Data JPA, Security, Actuator, Mail |
| API Gateway | Spring Cloud Gateway | Reactive, non-blocking |
| ORM | Spring Data JPA / Hibernate | PostgreSQL dialect, Hibernate `@Filter` for multi-tenancy |
| Database | PostgreSQL 15 | One instance per service |
| Cache / Lock | Redis 7 + Redisson | One Redis per service; Redisson for distributed locks |
| Message Broker | Apache Kafka 7.4 (Confluent) | With Zookeeper |
| HTTP Client | Spring Feign / WebClient | Feign for service-to-service; WebClient in analytics |
| Resilience | Resilience4j | Circuit breaker on all inter-service HTTP calls |
| Security | Spring Security + JJWT 0.12.3 | HS256, BCrypt strength 10 |
| Build | Maven | Per-service |
| Containerisation | Docker | Multi-stage builds |
| Orchestration | Kubernetes | Manifests in `k8s/` |

### Frontend

| Layer | Technology | Notes |
|-------|-----------|-------|
| Framework | Next.js 14.2.3 | App Router |
| Language | TypeScript 5 | |
| UI Primitives | Radix UI (shadcn/ui) | Accessible, headless |
| Styling | Tailwind CSS 3 | |
| Charts | Recharts | Spend and performance dashboards |
| Forms | React Hook Form + Zod | Schema-validated |
| State | Zustand 4 | Auth store with `localStorage` persistence |
| HTTP | Axios 1.6 | Centralised API client with interceptors |

---

## 7. Security Model

### JWT Authentication Flow

```
Client → POST /api/auth/login { email, password, tenantDomain? }
       ← { accessToken, userId, email, fullName, role, tenantId, tenantName, mustChangePassword }

Client → GET /api/vendors (Authorization: Bearer <token>)
       → API Gateway: validates signature + expiry → forwards request
       → vendor-service: re-validates → extracts tenantId → enables Hibernate @Filter
       ← vendor data (only rows where tenant_id = <tenantId from JWT>)
```

### Token Claims

```json
{
  "sub": "42",
  "email": "officer@acme.com",
  "role": "OFFICER",
  "permissions": "vendors:read,vendors:create,rfq:create,bids:evaluate,po:create,...",
  "tenantId": 3,
  "iat": 1700000000,
  "exp": 1700028800
}
```

> **Note:** `permissions` is a comma-separated string embedded at login time. Services extract it from the token with no database round-trip.

### Account Security

- BCrypt password hashing (strength 10)
- Account lockout after 5 consecutive failed attempts; reset on successful login
- Admin-only account unlock with audit trail entry
- `mustChangePassword` flag: admin-created users must change password on first login
- Password reset via emailed time-limited token
- Session expiry warning shown 5 minutes before JWT expiry; auto-logout on expiry

### Vendor Approval Gate

```
Vendor registers → accountLocked=true, approvalStatus=PENDING_APPROVAL
                 → login rejected until admin approves
Admin approves  → accountLocked=false, approvalStatus=APPROVED
                 → vendor notified by email (vendor.verified Kafka event)
```

---

## 8. Multi-Tenancy

The system is a multi-tenant SaaS platform. A single deployment serves multiple independent organisations, each with fully isolated data.

### Strategy: Shared Schema, Row-Level Isolation

Every business entity has a `tenant_id` column. A Hibernate `@Filter` automatically appends `WHERE tenant_id = :tenantId` to every query when the filter is active.

```java
@FilterDef(name = "tenantFilter", parameters = @ParamDef(name = "tenantId", type = Long.class))
@Filter(name = "tenantFilter", condition = "tenant_id = :tenantId")
public class Vendor { ... }
```

### TenantContext → TenantAspect Pipeline

```
JWT claim (tenantId)
   ↓ JwtAuthenticationFilter
TenantContext.setTenantId(tenantId)    ← ThreadLocal per request
   ↓ TenantAspect (@Around every public @Service method)
session.enableFilter("tenantFilter").setParameter("tenantId", tenantId)
   ↓ All JPA queries automatically scoped to this tenant
```

`TenantContext.clear()` is called after every request to prevent thread pool reuse from leaking a tenant ID.

### Why No X-Tenant-ID Header

Headers can be spoofed. The `tenantId` is embedded inside the signed JWT. Altering it invalidates the HMAC signature — the gateway rejects it. All tenant identity flows from the signed token only.

### Tenant Switching

Users who belong to multiple organisations see a tenant-switcher dropdown in the header. Selecting a tenant calls `POST /api/auth/switch-tenant` which validates the user's email exists in the target tenant and issues a new JWT with the target `tenantId`. All subsequent requests use the new organisation's data.

### Tenant Entity

```
Tenant { tenantId, name, domain (unique), status (ACTIVE/SUSPENDED/TRIAL),
         subscriptionPlan (BASIC/PRO/ENTERPRISE), settings (JSONB) }
```

SUPER_ADMIN can create, suspend, and activate tenants via `POST /api/super-admin/tenants`.

---

## 9. Data Architecture

### Database-per-Service

No service queries another service's database directly. Cross-service data needs are satisfied through:

1. **Synchronous REST calls** for real-time lookups (e.g., vendor name resolution when publishing a bid event)
2. **Kafka events with enriched payloads** for async workflows (e.g., `vendorEmail` embedded in `po.approved` event so notification-service doesn't need to call vendor-service)
3. **Client-side caching** for display names (vendor name map in the frontend)

### Schema Management

All services use `spring.jpa.hibernate.ddl-auto: update` — Hibernate creates or alters tables to match entity definitions on startup. This is suitable for development. Production deployments should migrate to Flyway versioned scripts.

### Key Indexes

Every table has:
- `tenant_id` alone — for tenant-scoped count queries
- `(tenant_id, status)` — for the most common filter: "show open items for this tenant"
- Domain-specific indexes (e.g., `(rfq_id, total_score DESC)` on bids for ranked-bid queries without in-memory sort)

### Optimistic Locking

`RFQ`, `Bid`, `PurchaseOrder`, and `Vendor` entities carry a `@Version` (Integer) column. Hibernate throws `OptimisticLockException` if two concurrent edits collide, preventing silent lost updates.

### Money: BigDecimal

All monetary columns (`totalAmount`, `bidAmount`, `invoiceAmount`, etc.) use `BigDecimal` — never `double` — to avoid binary floating-point rounding errors on financial figures.

---

## 10. Event-Driven Communication

### Kafka Topics

| Topic | Producer | Consumers | Key Payload Fields |
|-------|----------|-----------|--------------------|
| `vendor.verified` | vendor-service | notification-service | vendorId, vendorName, email, tenantId |
| `rfq.published` | rfq-bidding-service | notification-service | rfqId, title, deadline, estimatedValue, categoryId |
| `bid.submitted` | rfq-bidding-service | notification-service | bidId, rfqId, vendorId, bidAmount, vendorName, rfqTitle, rfqCreatorEmail |
| `po.approved` | procurement-service | notification-service | poId, vendorId, vendorEmail, vendorName, totalAmount, tenantId |
| `delivery.completed` | delivery-invoice-service | notification-service, scoring-service | deliveryId, poId, vendorId, expectedDate, actualDate, onTime, adminEmail |
| `invoice.discrepancy` | delivery-invoice-service | notification-service, scoring-service | invoiceId, poId, vendorId, discrepancyReason, amount |
| `score.updated` | scoring-service | _(available, no current consumer)_ | vendorId, overallScore, riskLevel |

### Producer Configuration

```yaml
spring:
  kafka:
    producer:
      acks: all                        # Wait for all in-sync replicas
      retries: 3
      properties:
        enable.idempotence: true       # Exactly-once on retries
        max.in.flight.requests.per.connection: 5
```

Every `kafkaTemplate.send()` call is followed by `.whenComplete()` for failure logging — silent send failures are never swallowed.

### Consumer Retry Strategy

```java
@RetryableTopic(
    attempts = "3",
    backoff = @Backoff(delay = 1000, multiplier = 2.0)  // 1s → 2s → 4s
)
@KafkaListener(topics = "delivery.completed", groupId = "notification-service-group")
public void handleDeliveryCompleted(DeliveryCompletedEvent event) { ... }
```

All 6 consumer topic handlers in notification-service and scoring-service use this pattern. Exhausted messages land in a dead-letter topic (`<topic>-dlt`) and are logged with full context.

### Trusted Packages

```yaml
spring.kafka.consumer.properties:
  spring.json.trusted.packages: "com.procurement.*,java.util.*"
```

Prevents arbitrary class instantiation from malicious Kafka messages.

---

## 11. Vendor Scoring Engine

### Scoring Formula

```
totalScore = (onTimeDeliveryRate  × weightDelivery)
           + (qualityAverage      × weightQuality)
           + (priceCompetitiveness × weightPrice)
           + (complianceScore     × weightCompliance)

Default weights: delivery 30%, quality 40%, price 20%, compliance 10%
(Configurable via ScoringWeights entity)
```

### Risk Classification

| Score | Risk Level |
|-------|-----------|
| ≥ 75 | LOW |
| 40–74 | MEDIUM |
| < 40 | HIGH |

### KPI Sources

| KPI | Data Source | Trigger |
|-----|------------|---------|
| On-time delivery rate | `delivery.completed` event (`onTime` flag) | Every delivery completion |
| Quality average | `bid.qualityScore` + invoice discrepancy count | Delivery + invoice events |
| Price competitiveness | Bid amounts vs. average for same RFQ category | `bid.submitted` event |
| Compliance | Vendor verification status, document expiry | Manual recalculation |

### Bid Evaluation Integration

When an officer evaluates bids, `rfq-bidding-service` calls `GET /api/scores/vendor/{id}/performance` to get the vendor's historical KPIs. These feed into `totalScore` on the `Bid` entity. New vendors (no history) receive fallback defaults (50/100) so they can still compete.

### Score History

Every scoring event creates a new `VendorPerformanceRecord`. This enables trend analysis and provides an audit trail for procurement decisions ("why was this vendor selected?").

---

## 12. Approval Workflows

### Purchase Requisition Approval

```
DRAFT  →  SUBMITTED  →  APPROVED
                     →  REJECTED
```

- Any user submits; MANAGER/DIRECTOR/ADMIN approves or rejects.
- Every decision is written to `ApprovalHistory` (approver, level, decision, comments, timestamp) — immutable.
- Multi-level configured via `currentApprovalLevel` on the requisition.

### Purchase Order Approval

```
PO Created (Draft / Pending Approval)
     ↓
Manager / Director / Admin: POST /api/purchase-orders/{id}/approve
     ↓                   or: POST /api/purchase-orders/{id}/reject
status = "Approved"
     ↓
po.approved Kafka event → vendor notified by email with PO details
```

Segregation of duties: the officer who creates the PO cannot approve it. Approval requires MANAGER, DIRECTOR, or ADMIN role.

---

## 13. 3-Way Invoice Matching

Every invoice is automatically validated against three sources of truth before it can be approved for payment.

```
Vendor submits invoice
         ↓
POST /api/threewaymatch/validate { poId, deliveryId, invoiceId }
         ↓
Check 1 — Price match:   invoiceAmount  ≈  PO totalAmount
Check 2 — Qty match:     quantityDelivered  ==  PO expectedQuantity
         ↓
    Both pass?
   ┌──────┴──────┐
  Yes             No
   ↓               ↓
ThreeWayMatch    ThreeWayMatch.status = MISMATCH
status = MATCHED  Invoice.status = Disputed
Invoice.status   Invoice.discrepancyFlag = true
= Validated      invoice.discrepancy Kafka event published
                 Officer receives in-app + email notification
                 Dispute entity created for manual resolution
```

---

## 14. Caching & Resilience

### Redis Caching

Each service has its own Redis instance (64 MB, `allkeys-lru` eviction). All cache keys are tenant-prefixed:

```java
// CacheConfig.java — custom KeyGenerator
"tenant:" + TenantContext.getTenantId() + ":" + methodName + ":" + args
```

This prevents cross-tenant cache hits even within the same Redis instance.

```java
@Cacheable(value = "vendors", key = "#tenantId + ':' + #vendorId", sync = true)
public VendorResponse getVendorById(...) { ... }

@CacheEvict(value = "vendors", key = "#tenantId + ':' + #vendorId")
public VendorResponse updateVendor(...) { ... }
```

### Distributed Locking (Redisson)

```java
@DistributedLock(key = "'user:update:' + #userId", waitTime = 5, leaseTime = 30)
public UserResponse updateUser(Long userId, ...) { ... }
```

`waitTime = 5s` (time to acquire), `leaseTime = 30s` (auto-release if the JVM crashes mid-operation). Prevents lost updates on concurrent requests across multiple service instances.

### Circuit Breaker (Resilience4j)

All inter-service HTTP calls are wrapped:

```yaml
resilience4j:
  circuitbreaker:
    configs:
      default:
        slidingWindowSize: 10
        failureRateThreshold: 50       # Open after 50% failures
        waitDurationInOpenState: 10s
        permittedNumberOfCallsInHalfOpenState: 3
```

Services return fallback responses (not errors) when a downstream service's circuit is open.

---

## 15. Frontend Application

### Architecture

Next.js 14 App Router. All API calls go exclusively through the API Gateway — never directly to a microservice.

**Route structure:**

```
/                          Landing / redirect
/login                     Authentication (with optional tenantDomain)
/register                  Vendor self-registration
/(dashboard)/
  /vendors                 Vendor list, profiles, performance (ADMIN, OFFICER, MANAGER, DIRECTOR, AUDITOR)
  /rfq                     RFQ list, create, bid management (all roles see differently)
  /procurement             Purchase requisitions + purchase orders (OFFICER, MANAGER, DIRECTOR, ADMIN)
  /orders                  Purchase order list with status filters (most roles)
  /deliveries              Delivery tracking, mark-delivered action (most roles)
  /invoices                Invoice submission, 3-way match, disputes (most roles)
  /inventory               Stock management, reorder shortcut (most roles)
  /scoring                 Vendor performance rankings and KPI breakdown (most roles)
  /analytics               Spend reports, compliance, dashboards (ADMIN, MANAGER, DIRECTOR, AUDITOR)
  /notifications           Notification centre
  /settings                System, notification, and security settings (ADMIN, DIRECTOR)
  /profile                 User profile, change-password
  /admin/users             User management (ADMIN, SUPER_ADMIN)
  /admin/audit             Audit log viewer (AUDITOR, ADMIN)
  /admin/super             Super-admin tenant management (SUPER_ADMIN only)
```

### Auth State (Zustand)

```typescript
useAuthStore: {
  user, token, tenantId, tenantName, isAuthenticated,
  setAuth(), logout(), hasRole(roles[]), hasPermission(permission)
}
```

State is persisted to `localStorage['auth-storage']`. On app boot, `onRehydrateStorage` decodes the stored JWT and calls `logout()` if it is expired.

### API Client (`lib/api.ts`)

Centralised Axios instance with:

- **Request interceptor:** attaches `Authorization: Bearer {token}` to every request; validates expiry before sending.
- **Response interceptor:** 401 → auto-logout and redirect to `/login`; 403 → permission error; 5xx/timeout/network → user-friendly error message.

Named exports: `authApi`, `vendorApi`, `rfqApi`, `bidApi`, `poApi`, `deliveryApi`, `invoiceApi`, `threeWayMatchApi`, `disputeApi`, `scoringApi`, `inventoryApi`, `analyticsApi`, `requisitionApi`, `settingsApi`, `notificationApi`, `auditApi`, `superAdminApi`.

### Role-Based UI

```tsx
// Page-level guard
<RequireRole roles={["ADMIN", "OFFICER"]}>
  <RFQPage />
</RequireRole>

// Action-level guard
{hasPermission("rfq:create") && <Button>Create RFQ</Button>}
{hasPermission("reports:view") && <Button>Download CSV</Button>}
```

The sidebar dynamically renders navigation items based on the authenticated user's role and permissions.

---

## 16. API Reference

All requests go through the API Gateway at `http://localhost:8080`. Attach `Authorization: Bearer <token>` to every request except login, register, forgot-password, and reset-password.

### Authentication

```http
POST /api/auth/login
{ "email": "...", "password": "...", "tenantDomain": "acme" }

POST /api/auth/register
{ "fullName": "...", "email": "...", "password": "...", "companyName": "..." }

POST /api/auth/forgot-password
{ "email": "user@company.com" }

POST /api/auth/reset-password
{ "token": "<reset-token>", "newPassword": "NewPass123!" }

POST /api/auth/change-password
{ "currentPassword": "...", "newPassword": "..." }

GET  /api/auth/me
POST /api/auth/switch-tenant
{ "tenantDomain": "other-org" }
```

**Login response:**
```json
{
  "accessToken": "eyJhbGci...",
  "userId": 42,
  "email": "officer@acme.com",
  "fullName": "Jane Smith",
  "role": "OFFICER",
  "tenantId": 3,
  "tenantName": "Acme Corp",
  "mustChangePassword": false
}
```

### User Management (ADMIN / SUPER_ADMIN)

```http
GET  /api/admin/users
POST /api/admin/users
PUT  /api/admin/users/{userId}
POST /api/admin/users/{userId}/lock
POST /api/admin/users/{userId}/unlock
GET  /api/admin/audit-logs

GET  /api/auth/vendor-approvals/pending
POST /api/auth/vendor-approvals/{userId}/approve
POST /api/auth/vendor-approvals/{userId}/reject
```

### Tenant Management (SUPER_ADMIN only)

```http
GET  /api/super-admin/tenants
POST /api/super-admin/tenants
PUT  /api/super-admin/tenants/{tenantId}
POST /api/super-admin/tenants/{tenantId}/suspend
POST /api/super-admin/tenants/{tenantId}/activate
GET  /api/super-admin/overview
```

### Vendors

```http
GET  /api/vendors?page=0&size=50
GET  /api/vendors/{vendorId}
GET  /api/vendors/user/{userId}
POST /api/vendors/register
PUT  /api/vendors/{vendorId}
POST /api/vendors/{vendorId}/verify
PUT  /api/vendors/{vendorId}/status  { "status": "Suspended" }

GET  /api/vendors/{vendorId}/documents
POST /api/vendors/{vendorId}/documents     (multipart/form-data — file + metadata)
GET  /api/vendors/documents/{docId}/file   (authenticated download, streams file)
DELETE /api/vendors/documents/{docId}
```

### RFQs & Bids

```http
GET  /api/rfqs?page=0&size=50
GET  /api/rfqs/{rfqId}
POST /api/rfqs
{ "title": "...", "description": "...", "deadline": "2025-06-30T23:59:59",
  "estimatedValue": 75000.00, "categoryId": 1, "expectedQuantity": 50 }
PUT  /api/rfqs/{rfqId}
POST /api/rfqs/{rfqId}/close

GET  /api/bids/rfq/{rfqId}
GET  /api/bids/rfq/{rfqId}/ranked
GET  /api/bids/vendor/{vendorId}
POST /api/bids
{ "rfqId": 1, "vendorId": 3, "bidAmount": 68500.00,
  "proposalText": "...", "deliveryDays": 14 }
POST /api/bids/{bidId}/evaluate
POST /api/bids/{bidId}/award
POST /api/bids/rfq/{rfqId}/evaluate-all
```

### Purchase Requisitions

```http
GET  /api/procurement/requisitions?page=0&size=50
GET  /api/procurement/requisitions/{id}
GET  /api/procurement/requisitions/my
GET  /api/procurement/requisitions/status/{status}
POST /api/procurement/requisitions
{ "department": "IT", "justification": "...", "estimatedBudget": 5000,
  "items": [{ "itemName": "Laptop", "quantity": 5, "estimatedUnitPrice": 1000, "unit": "pcs" }] }
POST /api/procurement/requisitions/{id}/approve
{ "decision": "APPROVED", "comments": "Budget confirmed" }
```

### Purchase Orders

```http
GET  /api/purchase-orders?page=0&size=50
GET  /api/purchase-orders/{poId}
POST /api/purchase-orders
{ "rfqId": 1, "vendorId": 3, "totalAmount": 68500.00,
  "expectedDeliveryDate": "2025-04-15" }
POST /api/purchase-orders/{poId}/approve
POST /api/purchase-orders/{poId}/reject  { "reason": "..." }
PUT  /api/purchase-orders/{poId}/status  { "status": "Cancelled" }
```

### Deliveries & Invoices

```http
GET  /api/deliveries?page=0&size=50
GET  /api/deliveries/po/{poId}
POST /api/deliveries
{ "poId": 1, "expectedDate": "2025-04-15", "actualDate": "2025-04-14",
  "quantityDelivered": 50, "qualityRemarks": "All good." }
PUT  /api/deliveries/{id}/status  { "status": "Completed" }

GET  /api/invoices?page=0&size=50
POST /api/invoices  { "poId": 1, "vendorId": 3, "invoiceAmount": 68500.00 }
POST /api/invoices/{id}/validate
POST /api/invoices/{id}/dispute  { "reason": "..." }

POST /api/threewaymatch/validate
{ "poId": 1, "deliveryId": 2, "invoiceId": 3 }
GET  /api/threewaymatch/po/{poId}

GET  /api/disputes
POST /api/disputes/{id}/resolve  { "resolution": "Vendor issued credit note." }
```

### Scoring

```http
GET /api/scores/ranking
GET /api/scores/vendor/{vendorId}
GET /api/scores/vendor/{vendorId}/performance
POST /api/scores/calculate/{vendorId}
POST /api/scores/recalculate-all
```

### Analytics & Reports

```http
GET /api/dashboard/overview
GET /api/reports/spend
GET /api/reports/compliance
GET /api/reports/vendor-comparison?vendorIds=1,2,3
GET /api/analytics/activity?userId=42
```

### Inventory

```http
GET  /api/inventory?page=0&size=50
GET  /api/inventory/{id}
GET  /api/inventory/low-stock
POST /api/inventory
{ "itemCode": "IT-001", "name": "Laptop Dell XPS", "quantity": 50,
  "minStock": 10, "maxStock": 100, "unit": "pcs", "category": "IT" }
PUT  /api/inventory/{id}
DELETE /api/inventory/{id}
POST /api/inventory/{id}/adjust  { "delta": -5 }
```

### Notifications

```http
GET /api/notifications/user/{userId}
GET /api/notifications/user/{userId}/unread
PUT /api/notifications/{id}/read
```

---

## 17. Deployment

### Prerequisites

| Tool | Version |
|------|---------|
| Docker | 24.x+ |
| Docker Compose | 2.x+ |
| Java 21 + Maven 3.8 | (local dev only, not needed for Docker) |
| Node.js 18+ | (local frontend dev only) |
| kubectl | 1.24+ (Kubernetes only) |

---

### Option A: Docker Compose (recommended for local / dev)

Starts the full stack: Zookeeper, Kafka, 9 PostgreSQL instances, 9 Redis instances, all 10 microservices, and the Next.js frontend.

```bash
git clone <repo-url>
cd PMS

# Start everything
docker compose up -d

# Check all containers are healthy
docker compose ps

# Tail logs for a specific service
docker compose logs -f auth-service

# Stop and remove containers (data volumes persist)
docker compose down
```

**Access points:**

| | URL |
|-|-----|
| Frontend | http://localhost:3000 |
| API Gateway | http://localhost:8080 |
| Kafka | localhost:9092 |
| PostgreSQL (auth) | localhost:5432 |

**Default seeded account** (created by `DataInitializer` on first startup):

| Email | Password | Role |
|-------|----------|------|
| `admin@procurepro.com` | `Admin@123` | SUPER_ADMIN |

Create additional users through the admin UI or the API after login.

---

### Option B: Local Dev (infrastructure in Docker, services on JVM)

```bash
# Step 1 — Start only infrastructure
docker compose up -d zookeeper kafka \
  postgres-auth postgres-vendor postgres-rfq postgres-procurement \
  postgres-delivery postgres-scoring postgres-inventory postgres-notification \
  redis redis-auth redis-vendor redis-rfq redis-procurement \
  redis-delivery redis-scoring redis-analytics redis-notification

# Step 2 — Build all services (from project root)
for svc in auth-service vendor-service rfq-bidding-service procurement-service \
            delivery-invoice-service scoring-service analytics-service \
            inventory-service notification-service api-gateway; do
  (cd $svc && mvn clean package -DskipTests -q)
done

# Step 3 — Run each service (separate terminal per service)
java -jar auth-service/target/auth-service-*.jar
java -jar vendor-service/target/vendor-service-*.jar
# ... etc.

# Step 4 — Frontend
cd frontend && npm install && npm run dev
```

---

### Option C: Kubernetes

Complete manifests are in `k8s/`. Includes Kustomize, NGINX Ingress, and MetalLB.

```bash
# Deploy
kubectl apply -k k8s/

# Verify
kubectl get pods -n procurement
kubectl get ingress -n procurement

# Scale a service
kubectl scale deployment vendor-service --replicas=3 -n procurement

# Rolling update
kubectl set image deployment/auth-service auth-service=procurement/auth-service:v2 -n procurement
kubectl rollout undo deployment/auth-service -n procurement   # rollback if needed
```

---

## 18. Configuration Reference

### Environment Variables

All services accept these environment variables. Defaults shown are for local development.

| Variable | Default (dev) | Description |
|----------|--------------|-------------|
| `JWT_SECRET` | `dev-secret-key-change-in-prod` | HMAC-SHA256 signing secret — **min 32 chars, must be changed in production** |
| `JWT_EXPIRATION` | `28800000` | Token validity in milliseconds (8 hours) |
| `DB_URL` | per-service localhost JDBC URL | PostgreSQL JDBC URL |
| `DB_USERNAME` | `postgres` | Database username |
| `DB_PASSWORD` | `password` | Database password — **change in production** |
| `SPRING_KAFKA_BOOTSTRAP_SERVERS` | `localhost:9092` | Kafka broker address |
| `REDIS_HOST` | `localhost` | Redis hostname |
| `REDIS_PORT` | `6379` (varies per service) | Redis port |
| `SMTP_USERNAME` | _(empty — email disabled)_ | Gmail address or SMTP username |
| `SMTP_PASSWORD` | _(empty — email disabled)_ | Gmail App Password (not account password) |
| `FRONTEND_URL` | `http://localhost:3000` | CORS allowed origin; used in email links |
| `VENDOR_SERVICE_URL` | `http://localhost:8082` | Used by rfq-bidding and analytics services |
| `PROCUREMENT_SERVICE_URL` | `http://localhost:8084` | Used by delivery-invoice and analytics services |
| `SCORING_SERVICE_URL` | `http://localhost:8086` | Used by rfq-bidding service |
| `FILE_UPLOAD_DIR` | `uploads/vendors` | Vendor document storage path |
| `SPRING_PROFILES_ACTIVE` | _(none)_ | Set to `docker` to load `application-docker.yml` |

### Gmail SMTP Setup

1. Enable 2-Factor Authentication on the Gmail account.
2. Generate an App Password: Google Account → Security → App Passwords.
3. Set `SMTP_USERNAME=youremail@gmail.com` and `SMTP_PASSWORD=<app-password>`.

For production use a transactional email service (SendGrid, AWS SES, Mailgun) instead.

---

## 19. Observability

### Health Checks

```bash
GET http://localhost:{port}/actuator/health
GET http://localhost:{port}/actuator/info
GET http://localhost:{port}/actuator/metrics
```

Used as Kubernetes liveness and readiness probes.

### Logging

```yaml
logging:
  level:
    com.procurement: DEBUG       # Set to INFO in production
    org.springframework.security: WARN
    org.hibernate.SQL: WARN      # Set to DEBUG to see all SQL
```

### Dead-Letter Topic Monitoring

```bash
# List DLT topics
docker exec kafka kafka-topics.sh --bootstrap-server localhost:9092 --list | grep dlt

# Inspect failed messages
docker exec kafka kafka-console-consumer.sh \
  --bootstrap-server localhost:9092 \
  --topic delivery.completed-dlt \
  --from-beginning
```

### Database Access (development)

```bash
# Connect to any database (each exposed on host)
psql -h localhost -p 5432 -U postgres -d authdb       # auth
psql -h localhost -p 5433 -U postgres -d vendordb      # vendor
psql -h localhost -p 5434 -U postgres -d rfqdb         # rfq
psql -h localhost -p 5435 -U postgres -d procurementdb # procurement
# ... ports 5436–5439 for remaining services
```

---

## 20. Known Limitations & Future Work

### Current Limitations

- **Schema migrations:** All services use `ddl-auto: update`. Production deployments need Flyway versioned migration scripts.
- **Single Kafka broker:** `replication.factor=1` — not fault-tolerant. Production requires a 3-broker cluster with `replication.factor=3`.
- **No service mesh:** Inter-service traffic is plain HTTP. mTLS (via Istio or Linkerd) would add transport-level security.
- **Polling notifications:** The frontend polls for new notifications. Real-time push via WebSocket or Server-Sent Events would improve UX.
- **Analytics aggregation model:** The analytics service calls downstream services on each request (cached). A CQRS read model or data warehouse would be more scalable at high volume.
- **File storage:** Vendor documents are stored on a mounted Docker volume. Production should use cloud object storage (AWS S3, GCS).
- **JWT revocation:** Tokens are valid until expiry (up to 8 hours) — role/permission changes don't take effect until the next login.

### Planned Enhancements

- [ ] Flyway database migrations for all services
- [ ] Kafka cluster with 3 brokers and replication factor 3
- [ ] WebSocket real-time notifications
- [ ] Distributed tracing with OpenTelemetry + Jaeger
- [ ] Cloud object storage for vendor documents (S3/GCS)
- [ ] Automated integration test suite with Testcontainers
- [ ] Helm chart for Kubernetes deployment
- [ ] API versioning (`/api/v1/`, `/api/v2/`)
- [ ] ML-based vendor risk prediction using historical score data
- [ ] Mobile application

---

## 21. Project Structure

```
PMS/
├── api-gateway/                  Spring Cloud Gateway — JWT validation, rate limiting, routing
├── auth-service/                 Authentication, RBAC, multi-tenancy, audit logs, user management
├── vendor-service/               Vendor registration, verification, document uploads, categories
├── rfq-bidding-service/          RFQ lifecycle, bid submission, evaluation, award
├── procurement-service/          Purchase requisitions, purchase orders, multi-level approval
├── delivery-invoice-service/     Delivery tracking, invoice validation, 3-way match, disputes
├── scoring-service/              Weighted KPI scoring, risk classification, score history
├── analytics-service/            Spend reports, dashboards, vendor rankings (Redis-only, no DB)
├── inventory-service/            Inventory tracking, stock management, reorder alerts
├── notification-service/         In-app + email notifications, Kafka consumers
├── frontend/                     Next.js 14 web application
│   ├── app/                      App Router pages and layouts
│   ├── components/               Shared UI components (dialogs, tables, protected-route, etc.)
│   ├── lib/
│   │   ├── api.ts               Centralised API client — all endpoint definitions
│   │   └── auth-store.ts        Zustand auth store — user, token, permissions
│   └── public/
├── docs/                         Detailed technical documentation
│   ├── 00-overview.md           System overview (non-technical)
│   ├── 01-architecture.md       Microservices design and trade-offs
│   ├── 02-authentication-and-security.md
│   ├── 03-procurement-workflow.md
│   ├── 04-vendor-management.md
│   ├── 05-event-driven-design.md
│   ├── 06-data-and-caching.md
│   └── 07-frontend.md           and 08-infrastructure-and-deployment.md
├── k8s/                          Kubernetes manifests (Kustomize)
├── scripts/                      Utility scripts
├── docker-compose.yml            Full local stack definition
└── README.md                     This file
```

---

## License

Developed as a Final Year Capstone Project. Intended for educational and demonstration purposes.

---

*Built with Java 21 · Spring Boot 3.2 · Next.js 14 · Apache Kafka · PostgreSQL 15 · Redis 7*
