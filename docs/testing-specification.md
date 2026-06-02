# ProcurePro — Testing Specification

> **Project:** ProcurePro Procurement Management System  
> **Stack:** Java 21 · Spring Boot 3.2 · Next.js 14 · Apache Kafka · PostgreSQL 15 · Redis 7  
> **Test Framework:** JUnit 5 · Mockito · AssertJ · Spring Boot Test · Testcontainers  
> **Date:** June 2026

---

## Table of Contents

1. [Testing Philosophy](#1-testing-philosophy)
2. [Test Stack & Tools](#2-test-stack--tools)
3. [Test Pyramid & Coverage Targets](#3-test-pyramid--coverage-targets)
4. [Unit Tests — Service Layer](#4-unit-tests--service-layer)
5. [Unit Tests — Domain Logic](#5-unit-tests--domain-logic)
6. [Unit Tests — Security & Multi-Tenancy](#6-unit-tests--security--multi-tenancy)
7. [Integration Tests](#7-integration-tests)
8. [Contract Tests](#8-contract-tests)
9. [End-to-End Tests](#9-end-to-end-tests)
10. [Property-Based Tests](#10-property-based-tests)
11. [Frontend Tests](#11-frontend-tests)
12. [Test Data Strategy](#12-test-data-strategy)
13. [CI/CD Integration](#13-cicd-integration)
14. [Coverage Goals by Service](#14-coverage-goals-by-service)

---

## 1. Testing Philosophy

ProcurePro is a multi-tenant financial system. Errors in invoice validation, vendor scoring, PO approval, or
tenant isolation can have direct monetary and compliance consequences. The testing strategy is therefore
defence-in-depth:

- **Correctness first.** Every business rule that has a monetary, security, or data-isolation implication
  must be covered by an automated test before the feature is considered done.
- **Fail fast, fail loudly.** Tests must surface regressions at the unit level where feedback is immediate,
  not at the integration level where diagnosis is expensive.
- **Deterministic.** No test may depend on system time, random data, or external network calls without
  explicit mocking or Testcontainers isolation.
- **Tenant-safe.** Every test that exercises a service method must verify that tenant context is either
  correctly applied or correctly rejected when absent.

---

## 2. Test Stack & Tools

| Layer | Tool | Version | Purpose |
|-------|------|---------|---------|
| Unit runner | JUnit 5 (`junit-jupiter`) | 5.10 (via Spring Boot 3.2) | Test lifecycle, parameterised tests |
| Mocking | Mockito + `MockitoExtension` | 5.x | Isolate service under test from repositories and clients |
| Assertions | AssertJ | 3.x | Fluent, readable assertions |
| Spring slices | `@WebMvcTest`, `@DataJpaTest`, `@SpringBootTest` | Spring Boot 3.2 | Partial context loads |
| Infrastructure | Testcontainers (PostgreSQL, Kafka, Redis) | 1.19+ | Real infrastructure for integration tests |
| Spring Security | `spring-security-test` | 6.x | `@WithMockUser`, `SecurityMockMvcRequestPostProcessors` |
| Kafka | `EmbeddedKafkaBroker` / Testcontainers Kafka | — | Consumer/producer integration tests |
| Property-based | jqwik | 1.8 | Invariant and boundary testing |
| Frontend unit | Jest + React Testing Library | Jest 29 | Component and hook tests |
| Frontend E2E | Playwright | 1.x | Browser-level flow tests |
| Mutation | PIT (PITest) | 1.15 | Validate test suite quality |

All Maven test dependencies are already declared via `spring-boot-starter-test`, which bundles JUnit 5,
Mockito, AssertJ, and Spring Test. Testcontainers and jqwik must be added to each service's `pom.xml`
as described in Section 13.


---

## 3. Test Pyramid & Coverage Targets

```
            ┌──────────┐
            │   E2E    │  ~10 flows  (Playwright — happy paths only)
            ├──────────┤
            │ Contract │  ~30 pacts  (Pact.io between gateway ↔ each service)
            ├──────────┤
            │Integrat. │  ~80 tests  (Testcontainers — DB, Kafka, Redis)
            ├──────────┤
            │  Unit    │  ~400 tests (Mockito — pure service/domain logic)
            └──────────┘
```

| Metric | Target |
|--------|--------|
| Line coverage (service layer) | ≥ 85 % |
| Branch coverage (domain logic) | ≥ 90 % |
| Mutation score (service layer) | ≥ 70 % |
| All existing tests pass | 100 % |
| No test relies on wall-clock time | 100 % |

---

## 4. Unit Tests — Service Layer

Unit tests use `@ExtendWith(MockitoExtension.class)`, mock all repositories and external clients, and
assert on the behaviour of the service class in isolation. Each subsection names the test class, the
method under test, and the scenarios to cover.

### 4.1 AuthService

**Class:** `AuthServiceTest` (already exists — extend with cases below)

| # | Method | Scenario | Expected |
|---|--------|----------|----------|
| 1 | `login` | Valid credentials, active tenant | JWT returned; `failedLoginAttempts` reset to 0 |
| 2 | `login` | Wrong password (first attempt) | Exception; `failedLoginAttempts` = 1 |
| 3 | `login` | Wrong password (4th → 5th attempt) | Account locked; `failedLoginAttempts` = 5 |
| 4 | `login` | Account already locked | Exception with "locked"; `passwordEncoder` never called |
| 5 | `login` | Suspended tenant | `TenantAccessException` thrown |
| 6 | `login` | No `tenantDomain` supplied | Domain derived from email suffix |
| 7 | `login` | `mustChangePassword = true` | Flag present in `LoginResponse` |
| 8 | `register` | New vendor, active tenant | `User` saved with correct tenant, role = VENDOR, `accountLocked = false` |
| 9 | `register` | Duplicate email same tenant | Exception containing "already registered" |
| 10 | `register` | Same email, different tenant | No exception; both users persisted |
| 11 | `register` | Suspended tenant | `TenantAccessException` |
| 12 | `switchTenant` | User exists in target tenant | New JWT issued with target `tenantId` |
| 13 | `switchTenant` | User not found in target tenant | Exception |
| 14 | `resetPassword` | Valid token, unexpired | Password hash updated; token invalidated |
| 15 | `resetPassword` | Expired token | Exception |
| 16 | `changePassword` | Current password matches | New hash saved |
| 17 | `changePassword` | Current password wrong | Exception; hash unchanged |
| 18 | `unlockAccount` | Admin unlocks locked user | `accountLocked = false`; audit log entry saved |


### 4.2 VendorService

**Class:** `VendorServiceTest` (already exists — extend with cases below)

| # | Method | Scenario | Expected |
|---|--------|----------|----------|
| 1 | `registerVendor` | New vendor, tenant in context | `tenantId` on saved entity = context value |
| 2 | `registerVendor` | Duplicate email | Exception; `save` never called |
| 3 | `registerVendor` | Category not found | Exception; `save` never called |
| 4 | `registerVendor` | No tenant context | Saved `tenantId` is null (documents expected behaviour) |
| 5 | `registerVendor` | Two calls, different tenants | Each vendor carries its own `tenantId` |
| 6 | `verifyVendor` | Officer verifies pending vendor | `complianceStatus = Verified`; `vendor.verified` Kafka event published |
| 7 | `verifyVendor` | Already verified vendor | Idempotent — no exception, no duplicate event |
| 8 | `updateVendorStatus` | Status → Suspended | Status updated; cache evicted |
| 9 | `updateVendorStatus` | Vendor has open POs | Warning included in response |
| 10 | `getVendor` | Vendor not found | Exception containing "Vendor not found" |
| 11 | `updateVendor` | Valid update | Updated fields persisted; cache evicted |
| 12 | `uploadDocument` | Valid file type (PDF) | Document entity saved; file path recorded |
| 13 | `uploadDocument` | Invalid file type (.exe) | Exception; no file written |
| 14 | `uploadDocument` | File exceeds 10 MB | Exception; no file written |
| 15 | `deleteDocument` | Document belongs to vendor | File deleted; entity removed |

### 4.3 RfqBiddingService

**Class:** `RfqBiddingServiceTest` (new)

| # | Method | Scenario | Expected |
|---|--------|----------|----------|
| 1 | `createRfq` | Valid request | RFQ saved with `OPEN` status; `rfq.published` event sent |
| 2 | `submitBid` | Within deadline | Bid saved; `bid.submitted` event sent |
| 3 | `submitBid` | After deadline | Exception; bid not saved |
| 4 | `submitBid` | Vendor not verified | Exception; bid not saved |
| 5 | `closeExpiredRfqs` | RFQ past deadline | Status set to `CLOSED`; no event published for already-closed RFQs |
| 6 | `evaluateBid` | Scoring service responds | `totalScore` populated on bid entity |
| 7 | `evaluateBid` | Scoring service circuit open | Fallback defaults applied; no exception propagated |
| 8 | `awardBid` | Winning bid selected | RFQ status → `Awarded`; other bids remain unchanged |
| 9 | `awardBid` | RFQ already awarded | Exception |
| 10 | `getRankedBids` | Multiple bids | Returned in descending `totalScore` order |


### 4.4 ProcurementService

**Class:** `ProcurementServiceTest` (new)

| # | Method | Scenario | Expected |
|---|--------|----------|----------|
| 1 | `createRequisition` | Any authenticated user | Requisition saved with `DRAFT` status |
| 2 | `submitRequisition` | Officer submits draft | Status → `SUBMITTED`; `ApprovalHistory` entry created |
| 3 | `approveRequisition` | Manager approves | Status → `APPROVED`; approval history appended |
| 4 | `approveRequisition` | Submitter tries self-approval | Exception (segregation of duties) |
| 5 | `rejectRequisition` | Manager rejects with comment | Status → `REJECTED`; comment recorded in history |
| 6 | `createPurchaseOrder` | From awarded bid | PO saved with `PENDING_APPROVAL` status |
| 7 | `approvePurchaseOrder` | Manager approves PO | Status → `Approved`; `po.approved` Kafka event sent |
| 8 | `approvePurchaseOrder` | Creator approves own PO | Exception (segregation of duties) |
| 9 | `rejectPurchaseOrder` | Director rejects | Status → `Rejected`; reason persisted |
| 10 | `cancelPurchaseOrder` | Cancel before delivery | Status → `Cancelled` |
| 11 | `convertRequisitionToRfq` | Approved requisition | New RFQ created with data from requisition |
| 12 | `convertRequisitionToRfq` | Non-approved requisition | Exception |

### 4.5 DeliveryInvoiceService

**Class:** `DeliveryInvoiceServiceTest` (new)

| # | Method | Scenario | Expected |
|---|--------|----------|----------|
| 1 | `createDelivery` | On time | `delayDays = 0`; event published; PO status → Delivered |
| 2 | `createDelivery` | Actual date after expected | `delayDays` = correct calendar delta |
| 3 | `createDelivery` | No tenant context | `IllegalStateException` |
| 4 | `updateDeliveryStatus` | Status → "delivered" (lowercase) | Canonical "Delivered" saved |
| 5 | `updateDeliveryStatus` | Invalid status string | Exception with allowed values listed |
| 6 | `updateDeliveryStatus` | Status → Delivered | `syncPoOnDelivery` triggered; Kafka event sent |
| 7 | `submitInvoice` | Valid PO and amount | Invoice saved with `PENDING` status |
| 8 | `validateInvoice` | Amounts match, delivery exists | Invoice → `APPROVED`; no discrepancy event |
| 9 | `validateInvoice` | Amount mismatch | Invoice → `DISPUTED`; `invoice.discrepancy` event sent |
| 10 | `validateInvoice` | No confirmed delivery for PO | Exception: "no confirmed delivery found" |
| 11 | `performThreeWayMatch` | All three match | `ThreeWayMatch.status = MATCHED`; invoice → `APPROVED` |
| 12 | `performThreeWayMatch` | Quantity mismatch | `MISMATCH`; `mismatchReason` contains quantity detail |
| 13 | `performThreeWayMatch` | Price mismatch | `MISMATCH`; `mismatchReason` contains price detail |
| 14 | `performThreeWayMatch` | Both mismatched | `MISMATCH`; both reasons in `mismatchReason` |
| 15 | `markInvoicePaid` | Invoice in APPROVED status | Status → `PAID`; `invoice.paid` event sent |
| 16 | `markInvoicePaid` | Invoice in PENDING status | `IllegalStateException` (invalid transition) |
| 17 | `raiseDispute` | Valid dispute | `Dispute` saved with `OPEN` status; event published |
| 18 | `resolveDispute` | Outcome = APPROVE_INVOICE | Dispute → `RESOLVED`; linked invoice → `APPROVED` |
| 19 | `resolveDispute` | Outcome = REJECT_INVOICE | Dispute → `RESOLVED`; linked invoice → `REJECTED` |
| 20 | `resolveDispute` | Invalid outcome | Exception with allowed values |


### 4.6 ScoringService

**Class:** `ScoringServiceTest` (new)

| # | Method | Scenario | Expected |
|---|--------|----------|----------|
| 1 | `calculateAndUpdateScore` | On-time delivery, good quality | `overallScore ≥ 80`; riskLevel = "Low" |
| 2 | `calculateAndUpdateScore` | 5-day delay on 30-day window | `timelinessScore = 83`; score reduced proportionally |
| 3 | `calculateAndUpdateScore` | Full delay (≥ expectedDays) | `timelinessScore = 0` |
| 4 | `calculateAndUpdateScore` | No tenant context | `IllegalStateException` |
| 5 | `calculateAndUpdateScore` | New vendor (no history) | Cost defaults to 80; responsiveness defaults to 85 |
| 6 | `calculateAndUpdateScore` | History exists | Cost and responsiveness derived from records |
| 7 | `calculateAndUpdateScore` | `VendorScore` already exists | Updated in-place, not duplicated |
| 8 | `calculateAndUpdateScore` | `score.updated` event published | `kafkaTemplate.send` called with correct payload |
| 9 | `recalculateScoreForVendor` | Latest record exists | Synthetic event built from stored record; score recalculated |
| 10 | `recalculateScoreForVendor` | No record exists | Synthetic event uses defaults (0 delay, ACCEPTED quality) |
| 11 | `recalculateAllVendors` | 3 vendors, 1 throws | Returns count = 3; failure logged; no exception propagated |
| 12 | `handleBidSubmitted` | Valid event | Responsiveness score boosted by 5 points |
| 13 | `handleBidSubmitted` | Null vendorId | Method returns without error |
| 14 | `handleDeliveryCompleted` | Tenant from event payload | `TenantContext` set and cleared correctly |
| 15 | `getAllCompositeScoresRanked` | Multiple records per vendor | Only latest per vendor returned; sorted descending |

### 4.7 InventoryService

**Class:** `InventoryServiceTest` (new)

| # | Method | Scenario | Expected |
|---|--------|----------|----------|
| 1 | `createItem` | Valid item | Saved with correct `stockStatus` |
| 2 | `adjustStock` | Positive delta | Quantity increased; status recalculated |
| 3 | `adjustStock` | Negative delta to zero | `stockStatus = critical` |
| 4 | `adjustStock` | Negative delta below minimum | `stockStatus = low` |
| 5 | `adjustStock` | Item not found | Exception |
| 6 | `getLowStockItems` | Mixed items | Returns only items where `quantity ≤ minStock` |
| 7 | `deleteItem` | Item exists | Removed from repository |
| 8 | `deleteItem` | Item not found | Exception |

### 4.8 NotificationService

**Class:** `NotificationServiceTest` (new)

| # | Method | Scenario | Expected |
|---|--------|----------|----------|
| 1 | `handleVendorVerified` | Valid event | In-app notification saved; email send attempted asynchronously |
| 2 | `handlePoApproved` | Valid event | Vendor email notification sent with PO details |
| 3 | `handleDeliveryCompleted` | Delay > 7 days | Late delivery alert email sent to admin |
| 4 | `handleDeliveryCompleted` | Delay ≤ 7 days | No late delivery alert; standard notification only |
| 5 | `handleInvoiceDiscrepancy` | Valid event | In-app + email notification created |
| 6 | `sendEmail` | SMTP failure | Exception swallowed; in-app notification unaffected |
| 7 | `markAsRead` | Notification exists | `read = true` persisted |
| 8 | `getUnreadNotifications` | Mixed read/unread | Only unread returned for that userId |


---

## 5. Unit Tests — Domain Logic

Pure logic classes with no Spring context. These run in milliseconds with no mocks.

### 5.1 DeliveryQualityScorer

**Class:** `DeliveryQualityScorerTest` (new)

The scoring algorithm is a deterministic pure function. All branches must be exercised.

| # | Inputs | Expected Score |
|---|--------|---------------|
| 1 | rating = `ACCEPTED`, no issues, qty 50/50 | 100 |
| 2 | rating = `ACCEPTED_WITH_ISSUES`, no issues | 88 |
| 3 | rating = `REJECTED`, no issues | 40 |
| 4 | rating = `accepted` (lowercase) | 100 (case-normalised) |
| 5 | rating = `ACCEPTED`, issue = `DAMAGED` | min(100, 60) = 60 |
| 6 | rating = `ACCEPTED`, issue = `WRONG_SPEC` | 60 |
| 7 | rating = `ACCEPTED`, issue = `SHORT_SHIP` | 75 |
| 8 | rating = `ACCEPTED`, issue = `PACKAGING` | 88 |
| 9 | rating = `ACCEPTED`, issues = `DAMAGED,PACKAGING` | 60 (most severe wins) |
| 10 | rating = `ACCEPTED`, qty = 20/50 (ratio 0.4) | min(100, 60) = 60 |
| 11 | rating = `ACCEPTED`, qty = 40/50 (ratio 0.8) | min(100, 75) = 75 |
| 12 | rating = `ACCEPTED`, qty = 45/50 (ratio 0.9) | 100 (no penalty) |
| 13 | rating = `ACCEPTED_WITH_ISSUES`, issue = `DAMAGED`, qty = 20/50 | min(88, 60, 60) = 60 |
| 14 | rating = null, remarks = "damaged goods" | 60 (legacy path) |
| 15 | rating = null, remarks = "partial delivery" | 75 |
| 16 | rating = null, remarks = "minor issue" | 88 |
| 17 | rating = null, remarks = "all good" | 100 |
| 18 | rating = null, remarks = null | 100 |
| 19 | rating = null, remarks = "" | 100 |
| 20 | rating = `UNKNOWN_RATING` | Default 100 (switch default) |
| 21 | qty = 0, quantityOrdered = 0 | No quantity penalty applied |
| 22 | qty = null | No quantity penalty applied |

### 5.2 InvoiceStatus State Machine

**Class:** `InvoiceStatusTest` (new)

| # | From | To | Expected |
|---|------|----|----------|
| 1 | `PENDING` | `APPROVED` | Allowed |
| 2 | `PENDING` | `DISPUTED` | Allowed |
| 3 | `APPROVED` | `PAID` | Allowed |
| 4 | `DISPUTED` | `APPROVED` | Allowed (dispute resolved) |
| 5 | `DISPUTED` | `REJECTED` | Allowed |
| 6 | `PAID` | `APPROVED` | `IllegalStateException` (no going back from paid) |
| 7 | `REJECTED` | `APPROVED` | `IllegalStateException` |
| 8 | `APPROVED` | `PENDING` | `IllegalStateException` |

### 5.3 Risk Classification Logic

**Class:** `RiskClassificationTest` (new — embedded in `ScoringServiceTest` or standalone)

| # | `overallScore` | Expected `riskLevel` |
|---|---------------|----------------------|
| 1 | 80.00 | "Low" |
| 2 | 79.99 | "Medium" |
| 3 | 60.00 | "Medium" |
| 4 | 59.99 | "High" |
| 5 | 0.00 | "High" |
| 6 | 100.00 | "Low" |

### 5.4 Timeliness Score Formula

**Class:** `TimelinessScoreTest` (new — inline within `ScoringServiceTest`)

Formula: `max(0, (1 - delayDays / expectedDays) * 100)`

| # | `delayDays` | `expectedDays` | Expected |
|---|-------------|----------------|----------|
| 1 | 0 | 30 | 100 |
| 2 | 3 | 30 | 90 |
| 3 | 15 | 30 | 50 |
| 4 | 30 | 30 | 0 |
| 5 | 35 | 30 | 0 (clamped to 0) |
| 6 | 5 | 0 | 85 (expectedDays defaults to 30) |


---

## 6. Unit Tests — Security & Multi-Tenancy

### 6.1 JwtTokenProvider

**Class:** `JwtTokenProviderTest` (already exists — extend with cases below)

| # | Scenario | Expected |
|---|----------|----------|
| 1 | Generate token → extract `tenantId` | Matches input |
| 2 | Generate token → extract `userId` | Matches input |
| 3 | Generate token → extract `email` | Matches input |
| 4 | Generate token → extract `role` | Matches input |
| 5 | Valid token → `validateToken` | `true` |
| 6 | Garbage string → `validateToken` | `false` |
| 7 | Tampered payload → `validateToken` | `false` |
| 8 | Two tokens, different tenant IDs | Each returns its own `tenantId` |
| 9 | Two tokens, same email, different userIds | Each returns its own `userId` |
| 10 | Expired token (leaseTime = 1 ms) | `validateToken` returns `false` |
| 11 | Token signed with wrong secret | `validateToken` returns `false` |
| 12 | Permissions claim round-trip | Extracted permissions string matches input |

### 6.2 TenantContext

**Class:** `TenantContextTest` (already exists — complete)

Existing cases cover: set/get, clear, default null, overwrite, and thread isolation.
No additional cases required unless the class is changed.

### 6.3 TenantAspect

**Class:** `TenantAspectTest` (already exists — extend with cases below)

| # | Scenario | Expected |
|---|----------|----------|
| 1 | Tenant in context | Filter enabled with correct id; disabled after proceed |
| 2 | No tenant in context | `entityManager.unwrap` never called; `pjp.proceed()` still called |
| 3 | Downstream throws | Filter still disabled (finally block) |
| 4 | `tenantId = 99` | `filter.setParameter("tenantId", 99L)` verified |

### 6.4 JwtAuthenticationFilter

**Class:** `JwtAuthenticationFilterTest` (new — one per service)

| # | Scenario | Expected |
|---|----------|----------|
| 1 | Request with valid token | `SecurityContextHolder` populated; `TenantContext` set |
| 2 | Request without `Authorization` header | Filter chain continues; no security context |
| 3 | Request with invalid token | Filter chain continues; no security context; `TenantContext` not set |
| 4 | Permitted endpoint (`/api/auth/login`) | Filter skips validation |
| 5 | After filter completes | `TenantContext.clear()` called regardless of outcome |

### 6.5 SecurityConfig — Endpoint Access Rules

**Class:** `SecurityConfigTest` (new — using `@WebMvcTest`)

| # | Endpoint | Role | Expected HTTP |
|---|----------|------|---------------|
| 1 | `POST /api/auth/login` | Anonymous | 200 / 400 (not 401) |
| 2 | `POST /api/auth/register` | Anonymous | 200 / 400 |
| 3 | `GET /api/vendors` | `VENDOR` | 200 |
| 4 | `POST /api/admin/users` | `OFFICER` | 403 |
| 5 | `POST /api/admin/users` | `ADMIN` | 201 |
| 6 | `GET /api/super-admin/tenants` | `ADMIN` | 403 |
| 7 | `GET /api/super-admin/tenants` | `SUPER_ADMIN` | 200 |
| 8 | `POST /api/purchase-orders/{id}/approve` | `OFFICER` | 403 |
| 9 | `POST /api/purchase-orders/{id}/approve` | `MANAGER` | 200 |
| 10 | Any endpoint | No token | 401 |


---

## 7. Integration Tests

Integration tests use `@SpringBootTest` with Testcontainers to spin up real PostgreSQL, Kafka, and Redis
instances. They test the full stack from HTTP request through to database record.

### 7.1 Required Testcontainers Dependencies

Add to each service `pom.xml` in `<scope>test</scope>`:

```xml
<dependency>
    <groupId>org.testcontainers</groupId>
    <artifactId>junit-jupiter</artifactId>
    <version>1.19.3</version>
    <scope>test</scope>
</dependency>
<dependency>
    <groupId>org.testcontainers</groupId>
    <artifactId>postgresql</artifactId>
    <version>1.19.3</version>
    <scope>test</scope>
</dependency>
<dependency>
    <groupId>org.testcontainers</groupId>
    <artifactId>kafka</artifactId>
    <version>1.19.3</version>
    <scope>test</scope>
</dependency>
```

### 7.2 Auth Service Integration Tests

**Class:** `AuthServiceIT` — `@SpringBootTest` + Testcontainers PostgreSQL

| # | Flow | Assertions |
|---|------|-----------|
| 1 | Register → login | Login returns valid JWT; `userId` matches registered user |
| 2 | Register → login 5× wrong password → login again | 6th attempt rejected with locked error |
| 3 | Register → login → switch tenant | New JWT contains correct `tenantId` |
| 4 | Register → forgot password → reset password | Old password no longer works; new password works |
| 5 | Admin creates user → user logs in with `mustChangePassword = true` → changes password | Login no longer returns `mustChangePassword = true` |

### 7.3 Vendor Service Integration Tests

**Class:** `VendorServiceIT` — `@SpringBootTest` + Testcontainers PostgreSQL + Kafka

| # | Flow | Assertions |
|---|------|-----------|
| 1 | Register vendor → verify | `complianceStatus = Verified`; `vendor.verified` message on Kafka topic |
| 2 | Register vendor → upload document → download | Document bytes match original upload |
| 3 | Upload document > 10 MB | HTTP 400; no file stored on disk |
| 4 | Vendor A (tenant 1) cannot see Vendor B (tenant 2) | GET `/api/vendors` for tenant 1 returns only tenant 1 records |
| 5 | Suspend vendor with open PO | Response contains warning; status updated to Suspended |

### 7.4 Delivery & Invoice Integration Tests

**Class:** `DeliveryInvoiceServiceIT` — `@SpringBootTest` + Testcontainers PostgreSQL + Kafka

| # | Flow | Assertions |
|---|------|-----------|
| 1 | Create delivery → check PO status | PO status updated to "Delivered" via `procurementClient` |
| 2 | Create delivery → consume Kafka | `delivery.completed` event consumable from topic within 5 s |
| 3 | Submit invoice → validate (match) | Invoice → `APPROVED`; no Kafka event on discrepancy topic |
| 4 | Submit invoice → validate (mismatch) | Invoice → `DISPUTED`; `invoice.discrepancy` event on Kafka |
| 5 | 3-way match (all pass) → mark paid | Invoice → `PAID`; `invoice.paid` event on Kafka |
| 6 | Raise dispute → resolve (APPROVE) | Dispute → `RESOLVED`; linked invoice → `APPROVED` |

### 7.5 Scoring Service Integration Tests

**Class:** `ScoringServiceIT` — `@SpringBootTest` + Testcontainers PostgreSQL + Kafka

| # | Flow | Assertions |
|---|------|-----------|
| 1 | Publish `delivery.completed` → consume | `VendorScore` record persisted; `score.updated` on Kafka |
| 2 | Publish `bid.submitted` → consume | Responsiveness score incremented by 5 |
| 3 | Recalculate all vendors | All known vendors get updated composite scores |
| 4 | `GET /api/scores/ranking` | Returns vendors sorted by `weightedScore` descending |
| 5 | Kafka consumer retries on transient failure | After 3 attempts, message lands in DLT topic |

### 7.6 Multi-Tenancy Integration Test

**Class:** `MultiTenancyIT` — `@SpringBootTest` + Testcontainers PostgreSQL

This is the most critical integration test suite. Tenant isolation must be verified at the database row
level, not just in the service layer.

| # | Scenario | Assertion |
|---|----------|-----------|
| 1 | Two tenants; Tenant A creates vendor | Tenant B query returns 0 vendors |
| 2 | Tenant A creates RFQ | Tenant B `GET /api/rfqs` returns empty |
| 3 | Tenant A approves PO | Tenant B cannot see or action that PO |
| 4 | Token with `tenantId = 1` used against tenant 2 data | 0 results (Hibernate filter active) |
| 5 | `TenantContext.clear()` not called → next request | ThreadLocal leak: next request gets wrong tenant → test verifies clear is always called via filter teardown |


---

## 8. Contract Tests

Contract tests use [Pact.io](https://docs.pact.io/) to verify that the API Gateway and service consumers
agree on request/response shapes with each upstream provider. They run without a live environment.

### 8.1 Consumer Contracts (Gateway → Services)

Each route in `application.yml` of the API Gateway defines an implicit contract. Pact consumer tests
live in `api-gateway/src/test/` and define the expected shape of each provider's response.

| Consumer | Provider | Interaction |
|----------|----------|-------------|
| API Gateway | auth-service | `POST /api/auth/login` → `LoginResponse` shape |
| rfq-bidding-service | scoring-service | `GET /api/scores/vendor/{id}/performance` → `VendorPerformanceRecord` shape |
| delivery-invoice-service | procurement-service | `GET /api/purchase-orders/{id}` → PO object including `vendorId`, `totalAmount`, `expectedQuantity` |
| delivery-invoice-service | vendor-service | `GET /api/vendors/{id}` → vendor object including `email`, `companyName` |
| analytics-service | vendor-service | `GET /api/vendors` → vendor list shape |
| analytics-service | procurement-service | `GET /api/purchase-orders` → PO list shape |
| analytics-service | rfq-bidding-service | `GET /api/rfqs` → RFQ list shape |

### 8.2 Provider Verification

Provider tests run in each service's CI pipeline using `@PactVerification`. They replay consumer-defined
interactions against a running Spring Boot test slice to prove the provider honours its side of each contract.

---

## 9. End-to-End Tests

E2E tests use Playwright against a `docker compose up` environment. They cover the 10 critical user
journeys and run as a nightly gate in CI.

### 9.1 Critical User Journeys

| # | Journey | Roles Involved | Pass Criteria |
|---|---------|----------------|---------------|
| 1 | **Vendor onboarding** | VENDOR, ADMIN | Vendor registers → Admin approves → Vendor can log in |
| 2 | **Full procurement cycle** | OFFICER, MANAGER | Create RFQ → Vendor bids → Evaluate → Award → Create PO → Approve PO |
| 3 | **Invoice happy path** | VENDOR, OFFICER | Submit invoice → 3-way match passes → Mark paid |
| 4 | **Invoice dispute resolution** | VENDOR, OFFICER, MANAGER | Invoice disputed → Dispute raised → Resolved with APPROVE_INVOICE |
| 5 | **Password reset** | Any user | Request reset email → Use token → Login with new password |
| 6 | **Account lockout & unlock** | Any user, ADMIN | Fail login 5× → Account locked → Admin unlocks → Login succeeds |
| 7 | **Analytics dashboard** | ADMIN | Navigate to `/analytics` → All widgets render with data |
| 8 | **CSV export** | ADMIN | Click "Download CSV" on purchase orders → File downloaded with correct columns |
| 9 | **Low-stock reorder** | OFFICER | Navigate to `/inventory` → Click "Reorder" on low-stock item → Requisition pre-filled |
| 10 | **Tenant switching** | Multi-tenant user | Select second tenant → All data filtered to new tenant → Log out |

### 9.2 Playwright Configuration

```typescript
// playwright.config.ts
export default {
  baseURL: 'http://localhost:3000',
  use: {
    headless: true,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  testDir: 'e2e/',
  retries: 1,
  timeout: 60_000,
};
```

E2E tests must:
- Never hard-code credentials — use environment variables (`E2E_ADMIN_EMAIL`, `E2E_ADMIN_PASSWORD`).
- Use dedicated test tenant to avoid polluting seeded data.
- Clean up created entities after each test via the API or database transaction rollback.


---

## 10. Property-Based Tests

Property-based tests (PBT) use [jqwik](https://jqwik.net/) to generate hundreds of random inputs and
verify that the system's invariants always hold. Add jqwik to each `pom.xml`:

```xml
<dependency>
    <groupId>net.jqwik</groupId>
    <artifactId>jqwik</artifactId>
    <version>1.8.2</version>
    <scope>test</scope>
</dependency>
```

### 10.1 Correctness Properties

**Property 1 — Quality Score Bounded**

> For all valid combinations of `qualityRating`, `qualityIssueTypes`, `quantityDelivered`, and
> `quantityOrdered`, `DeliveryQualityScorer.computeQualityScore(...)` must always return a value
> in [0, 100].

```java
@Property
void qualityScoreAlwaysInRange(
    @ForAll @Nullable String rating,
    @ForAll @Nullable String issues,
    @ForAll @Nullable Integer qtyDelivered,
    @ForAll @Nullable Integer qtyOrdered,
    @ForAll @Nullable String remarks) {
    int score = DeliveryQualityScorer.computeQualityScore(rating, issues, qtyDelivered, qtyOrdered, remarks);
    assertThat(score).isBetween(0, 100);
}
```

**Property 2 — Timeliness Score Bounded**

> For all non-negative `delayDays` and positive `expectedDays`, the timeliness score must be in [0, 100].

**Property 3 — Overall Score Bounded**

> Given any individual component scores in [0, 100] and weights that sum to 1.0,
> `overallScore = Σ(componentScore × weight)` must also be in [0, 100].

**Property 4 — Weighted Score Monotonicity**

> If vendor A has higher or equal scores in all four KPI components compared to vendor B,
> vendor A's overall weighted score must be ≥ vendor B's overall weighted score.

**Property 5 — Tenant Isolation**

> For any two distinct `tenantId` values t1 and t2, entities persisted under t1 must never appear
> in a query scoped to t2. Generate random entity payloads, persist them alternately under t1 and t2,
> and assert that filtered queries return only the expected subset.

**Property 6 — JWT Round-Trip**

> For any `userId ∈ [1, Long.MAX_VALUE]`, `email` (valid format), `role`, `permissions`, and
> `tenantId ∈ [1, Long.MAX_VALUE]`, generating a token and immediately parsing it must recover
> all five values exactly.

**Property 7 — Invoice Status Transitions Are Acyclic**

> The `InvoiceStatus` state machine must have no cycles. A DFS over all valid transitions must
> terminate without revisiting a node.

**Property 8 — 3-Way Match Symmetry**

> Swapping `poAmount` and `invoiceAmount` such that they become equal must always produce status
> `MATCHED`. Introducing any non-zero difference must always produce `MISMATCH`.

---

## 11. Frontend Tests

### 11.1 Component Unit Tests (Jest + React Testing Library)

| # | Component | Scenario | Assertion |
|---|-----------|----------|-----------|
| 1 | `LoginForm` | Submit valid credentials | API call made with email and password |
| 2 | `LoginForm` | Submit empty email | Validation error shown; no API call |
| 3 | `RequireRole` | User has required role | Children rendered |
| 4 | `RequireRole` | User lacks required role | Redirect to `/login` or 403 page |
| 5 | `useAuthStore` | `setAuth` then `logout` | `isAuthenticated` transitions correctly |
| 6 | `useAuthStore` | Expired token on rehydrate | `logout()` called; `isAuthenticated = false` |
| 7 | `VendorTable` | 5 vendors returned | 5 rows rendered |
| 8 | `VendorTable` | Empty list | Empty state message shown |
| 9 | `NotificationBell` | 3 unread notifications | Badge shows "3" |
| 10 | `CSVExportButton` | User has `reports:view` permission | Button rendered |
| 11 | `CSVExportButton` | User lacks permission | Button absent |
| 12 | `Axios interceptor` | 401 response | `logout()` called; redirect to `/login` |
| 13 | `Axios interceptor` | 403 response | Permission error toast shown |
| 14 | `Axios interceptor` | 5xx response | Generic error toast shown |

### 11.2 Hook Tests

| # | Hook | Scenario | Assertion |
|---|------|----------|-----------|
| 1 | `hasRole` | Matching role | Returns `true` |
| 2 | `hasRole` | Non-matching role | Returns `false` |
| 3 | `hasPermission` | Permission in comma-separated string | Returns `true` |
| 4 | `hasPermission` | Permission absent | Returns `false` |
| 5 | Token expiry check | Token expiring in < 5 min | Warning shown |
| 6 | Token expiry check | Token expired | Auto-logout triggered |

### 11.3 Frontend Coverage Target

| Metric | Target |
|--------|--------|
| Statement coverage (components) | ≥ 75 % |
| Branch coverage (hooks, utils) | ≥ 80 % |


---

## 12. Test Data Strategy

### 12.1 Builder Pattern for Test Entities

Each test package should include a `TestBuilders` utility class to construct consistent, valid entity
instances. This avoids duplicating setup logic across tests and makes tests more readable.

Example pattern (following the style already used in `AuthServiceTest`):

```java
// TestBuilders.java (in src/test/java/com/procurement/authservice/)
public class TestBuilders {

    public static Tenant activeTenant(long tenantId, String domain) {
        return Tenant.builder()
            .tenantId(tenantId).name("Test Corp").domain(domain)
            .status(Tenant.TenantStatus.ACTIVE)
            .subscriptionPlan(Tenant.SubscriptionPlan.PRO)
            .build();
    }

    public static User vendorUser(long userId, String email, Tenant tenant, Role role) {
        User u = new User();
        u.setUserId(userId);
        u.setEmail(email);
        u.setPasswordHash("$2a$10$encodedHash");
        u.setTenant(tenant);
        u.setRole(role);
        u.setAccountLocked(false);
        u.setFailedLoginAttempts(0);
        return u;
    }
}
```

### 12.2 Monetary Values in Tests

All monetary assertions must use `BigDecimal` comparisons, never `double`:

```java
// Correct
assertThat(invoice.getInvoiceAmount()).isEqualByComparingTo(new BigDecimal("68500.00"));

// Wrong — floating-point imprecision
assertThat(invoice.getInvoiceAmount().doubleValue()).isEqualTo(68500.0);
```

### 12.3 Time in Tests

Never use `LocalDate.now()` or `LocalDateTime.now()` inside test assertions. Tests that depend on
wall-clock time are non-deterministic. Use fixed dates:

```java
private static final LocalDate TEST_DATE = LocalDate.of(2026, 1, 15);
private static final LocalDate LATE_DATE  = LocalDate.of(2026, 1, 22); // 7 days after TEST_DATE
```

### 12.4 Kafka Message Assertions

For integration tests that consume Kafka messages, use `ConsumerRecord` capture with a bounded timeout:

```java
ConsumerRecord<String, Object> record = KafkaTestUtils.getSingleRecord(
    testConsumer, "delivery.completed", Duration.ofSeconds(5));
assertThat(record.value()).isInstanceOf(DeliveryCompletedEvent.class);
```

### 12.5 Tenant Isolation in Test Data

Every integration test that creates data must use a unique `tenantId` derived from the test class to
prevent cross-test pollution when tests run in parallel:

```java
private static final long TENANT_ID = 9000L; // unique per test class
```

---

## 13. CI/CD Integration

### 13.1 Pipeline Stages

```
┌─────────────┐   ┌─────────────┐   ┌────────────────┐   ┌──────────┐   ┌──────────┐
│ Unit Tests  │──▶│ Integration │──▶│ Contract Tests │──▶│ Build    │──▶│ E2E      │
│ (all svc)   │   │  Tests      │   │ (Pact)         │   │ Images   │   │ (nightly)│
│ ~2 min      │   │  ~10 min    │   │  ~5 min        │   │ ~8 min   │   │ ~20 min  │
└─────────────┘   └─────────────┘   └────────────────┘   └──────────┘   └──────────┘
```

Unit and integration tests run on every push. E2E tests run on the nightly build and on release branches.

### 13.2 Maven Commands

```bash
# Run unit tests only (fast — no containers)
mvn test -Dgroups="unit" -pl auth-service,vendor-service,...

# Run all tests including integration (requires Docker)
mvn verify -pl auth-service

# Run with coverage report
mvn verify jacoco:report -pl auth-service

# Run mutation tests (slow — CI nightly only)
mvn test-compile org.pitest:pitest-maven:mutationCoverage -pl auth-service
```

### 13.3 JaCoCo Configuration

Add to each service `pom.xml` to enforce coverage thresholds at build time:

```xml
<plugin>
    <groupId>org.jacoco</groupId>
    <artifactId>jacoco-maven-plugin</artifactId>
    <executions>
        <execution>
            <goals><goal>prepare-agent</goal></goals>
        </execution>
        <execution>
            <id>check</id>
            <goals><goal>check</goal></goals>
            <configuration>
                <rules>
                    <rule>
                        <element>BUNDLE</element>
                        <limits>
                            <limit>
                                <counter>LINE</counter>
                                <value>COVEREDRATIO</value>
                                <minimum>0.85</minimum>
                            </limit>
                            <limit>
                                <counter>BRANCH</counter>
                                <value>COVEREDRATIO</value>
                                <minimum>0.80</minimum>
                            </limit>
                        </limits>
                    </rule>
                </rules>
            </configuration>
        </execution>
    </executions>
</plugin>
```

### 13.4 Test Tagging

Use JUnit 5 `@Tag` to separate unit from integration tests so developers can run fast feedback loops:

```java
@Tag("unit")
class AuthServiceTest { ... }

@Tag("integration")
@Testcontainers
class AuthServiceIT { ... }
```

Configure Maven Surefire to select `unit` and Failsafe to select `integration`.


---

## 14. Coverage Goals by Service

The table below shows the current state and the target. Services with existing tests are marked;
those with no tests yet are flagged as gaps.

| Service | Existing Test Classes | Unit Target | Integration Target | Gap |
|---------|-----------------------|-------------|-------------------|-----|
| `auth-service` | `AuthServiceTest`, `JwtTokenProviderTest`, `TenantAspectTest`, `TenantContextTest` | 90 % | 80 % | `switchTenant`, `resetPassword`, `unlockAccount` |
| `vendor-service` | `VendorServiceTest` | 85 % | 75 % | `verifyVendor`, document upload/delete, security config |
| `rfq-bidding-service` | _none_ | 85 % | 75 % | All — priority high (financial data) |
| `procurement-service` | _none_ | 85 % | 75 % | All — priority high (approval workflow) |
| `delivery-invoice-service` | _none_ | 88 % | 80 % | All — priority critical (3-way match, money) |
| `scoring-service` | _none_ | 90 % | 75 % | All — `DeliveryQualityScorer` domain logic first |
| `analytics-service` | _none_ | 70 % | 60 % | No DB; mock WebClient calls; Redis cache tests |
| `inventory-service` | _none_ | 80 % | 70 % | `adjustStock` branch coverage critical |
| `notification-service` | _none_ | 75 % | 65 % | SMTP failure isolation is highest priority |
| `api-gateway` | _none_ | 80 % | 70 % | Rate limit, JWT filter, circuit breaker fallback |

### Priority Order for Implementing Missing Tests

1. `delivery-invoice-service` — 3-way matching and invoice state machine have direct payment impact
2. `procurement-service` — approval workflow controls financial authorisation
3. `scoring-service` — `DeliveryQualityScorer` is pure domain logic, easiest first win
4. `rfq-bidding-service` — bid deadline enforcement and award idempotency
5. `auth-service` — extend existing tests (password reset, tenant switch, unlock)
6. `vendor-service` — extend existing tests (verify, document upload)
7. `inventory-service` — `adjustStock` boundary cases
8. `notification-service` — SMTP failure isolation
9. `analytics-service` — mock downstream calls, Redis TTL behaviour
10. `api-gateway` — rate limit token bucket, circuit breaker fallback responses

---

## Appendix A — Existing Test Inventory

| File | Class | Tests |
|------|-------|-------|
| `auth-service/.../security/JwtTokenProviderTest.java` | `JwtTokenProviderTest` | 9 |
| `auth-service/.../service/AuthServiceTest.java` | `AuthServiceTest` | 12 |
| `auth-service/.../tenant/TenantAspectTest.java` | `TenantAspectTest` | 4 |
| `auth-service/.../tenant/TenantContextTest.java` | `TenantContextTest` | 5 |
| `vendor-service/.../service/VendorServiceTest.java` | `VendorServiceTest` | 6 |
| **Total** | | **36** |

All 36 tests are passing. No integration tests exist in any service at the time of writing. The E2E
suite has not yet been created.

---

## Appendix B — Known Gaps & Risks

| Gap | Risk | Mitigation |
|-----|------|-----------|
| No integration tests | DB schema bugs (e.g., missing tenant column) only caught in production | Implement Testcontainers IT suite for critical services first |
| No Kafka consumer tests | Silent consumer failures go undetected | Add embedded Kafka tests; monitor DLT topics in staging |
| No frontend tests | UI regressions after API contract changes | Implement Playwright E2E for 10 critical flows |
| `ddl-auto: update` in all services | Schema drift in production | Migrate to Flyway; add schema validation test that starts the Spring context |
| Single Kafka broker | Replication factor 1 cannot be tested for durability | Add cluster tests in a dedicated staging environment |
| JWT revocation not tested | Stale tokens remain valid for up to 8 hours after role change | Document as accepted risk; add test that verifies 8-hour expiry is enforced |
| File upload path traversal | Malicious filenames could escape `uploads/` directory | Add unit test verifying UUID filename assignment; integration test with `../` in filename |

---

*This document should be updated whenever new services are added, business rules change, or coverage
targets are revised. It is the single source of truth for what must be tested and why.*
