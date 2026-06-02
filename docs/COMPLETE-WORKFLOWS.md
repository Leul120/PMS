# ProcurePro — Complete Workflow Guide

> **Purpose:** Single reference for every business workflow in the system — states, roles, APIs, events, and UI paths.  
> **Audience:** Developers, testers, business analysts, and operators.  
> **Last updated:** Reflects the current implementation (post workflow-integrity fixes).

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Roles & Segregation of Duties](#2-roles--segregation-of-duties)
3. [Document Chain & Traceability](#3-document-chain--traceability)
4. [Workflow 0 — Vendor Onboarding](#4-workflow-0--vendor-onboarding)
5. [Workflow 1 — Purchase Requisition](#5-workflow-1--purchase-requisition)
6. [Workflow 2 — Request for Quotation (RFQ)](#6-workflow-2--request-for-quotation-rfq)
7. [Workflow 3 — Bidding & Evaluation](#7-workflow-3--bidding--evaluation)
8. [Workflow 4 — Purchase Order (PO)](#8-workflow-4--purchase-order-po)
9. [Workflow 5 — Delivery & Receipt](#9-workflow-5--delivery--receipt)
10. [Workflow 6 — Invoice & 3-Way Match](#10-workflow-6--invoice--3-way-match)
11. [Workflow 7 — Payment (Manual)](#11-workflow-7--payment-manual)
12. [Workflow 8 — Disputes](#12-workflow-8--disputes)
13. [Workflow 9 — Vendor Performance Scoring](#13-workflow-9--vendor-performance-scoring)
14. [Event-Driven Integration (Kafka)](#14-event-driven-integration-kafka)
15. [API Quick Reference](#15-api-quick-reference)
16. [Frontend Routes by Role](#16-frontend-routes-by-role)
17. [Demo Accounts](#17-demo-accounts)

---

## 1. System Overview

ProcurePro implements a **procure-to-pay (P2P)** pipeline across microservices. Each step is a state transition enforced by service logic and role-based access.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         PROCURE-TO-PAY PIPELINE                              │
└─────────────────────────────────────────────────────────────────────────────┘

  [0] Vendor Onboarding          auth-service + vendor-service
           │
           ▼
  [1] Purchase Requisition       procurement-service
           │  (budget approval — multi-level)
           ▼
  [2] RFQ                        rfq-bidding-service
           │  (linked via requisitionId)
           ▼
  [3] Bidding & Award            rfq-bidding-service + scoring-service
           │
           ▼
  [4] Purchase Order             procurement-service
           │  (financial approval — amount-based)
           ▼
  [5] Delivery                   delivery-invoice-service  →  PO status: Delivered
           │
           ▼
  [6] Invoice + 3-Way Match      delivery-invoice-service
           │
           ▼
  [7] Payment (manual)           delivery-invoice-service  →  Invoice status: Paid
           │
           ▼
  [8] Disputes (if needed)       delivery-invoice-service
           │
           ▼
  [9] Vendor Scoring             scoring-service (ongoing)
```

**Services involved:**

| Service | Port | Responsibility |
|---------|------|----------------|
| `auth-service` | 8081 | Users, roles, JWT, vendor user approval |
| `vendor-service` | 8082 | Vendor profiles, documents, verification |
| `procurement-service` | 8084 | Requisitions, purchase orders |
| `rfq-bidding-service` | 8083 | RFQs, bids, evaluation, award |
| `delivery-invoice-service` | 8085 | Deliveries, invoices, 3-way match, disputes |
| `scoring-service` | 8086 | Vendor performance scores |
| `notification-service` | 8089 | Email/in-app alerts (Kafka consumer) |
| `api-gateway` | 8080 | Single entry point, JWT validation |
| `frontend` | 3000 | Next.js UI |

---

## 2. Roles & Segregation of Duties

| Role | Primary responsibility | Cannot do |
|------|------------------------|-----------|
| **REQUESTER** | Create requisitions, submit for approval | Approve requisitions, create RFQs/POs |
| **OFFICER** | RFQs, bid evaluation, PO creation, invoice validation | Approve POs (unless also MANAGER+) |
| **MANAGER** | Approve requisitions (L1), approve POs (< $50k) | Create RFQs |
| **DIRECTOR** | Approve requisitions (L2), approve POs (≥ $50k) | Create requisitions (by default) |
| **ADMIN** | Full internal access including L3 requisition approval | — |
| **AUDITOR** | Read-only across all modules | Any write action |
| **VENDOR_ADMIN** | Bid, deliver, invoice, manage team | Internal procurement actions |
| **VENDOR_SALES** | Submit bids | Submit invoices |
| **VENDOR_FINANCE** | Submit invoices, update deliveries | Submit bids |
| **SUPER_ADMIN** | Cross-tenant administration | — |

**Design intent:** The person who **requests** budget (REQUESTER/OFFICER) is separated from the person who **approves** it (MANAGER/DIRECTOR/ADMIN) and from the person who **sources** vendors (OFFICER).

### Enterprise dual-hat organisations (`organizationType = BOTH`)

Large enterprises that **buy and sell** use separate **operating contexts** (similar to SAP MM vs SD or Coupa buyer vs supplier portals):

| Concept | Behaviour |
|---------|-----------|
| **Procurement context** | JWT effective role = primary role (`ADMIN`, `OFFICER`, …). Sidebar shows P2P modules. |
| **Sales context** | JWT effective role = optional `supplierRole` (`VENDOR_SALES`, `VENDOR_LOGISTICS`, …). Sidebar shows Sales Portal. |
| **Context switch** | `POST /api/auth/switch-context` with `{ "context": "PROCUREMENT" \| "SALES" }` reissues token. |
| **Segregation** | `ADMIN` / `MANAGER` do **not** gain bid-submit permissions; assign a dedicated `supplierRole` for sales work. |

**Admin setup:** Team → Add User → set procurement role + optional **Sales role** (BOTH tenants only).  
**Demo:** `alice@procurement.com` is `OFFICER` with supplier role `VENDOR_SALES` — use the header **Procurement | Sales** toggle after login.

---

## 3. Document Chain & Traceability

Every downstream document can be traced back to the original need:

```
PurchaseRequisition (requisitionId)
        │
        ├──► RFQ (requisitionId) ──► Bid (bidId) ──► Award
        │                                    │
        └────────────────────────────────────┴──► PO (requisitionId, rfqId, bidId)
                                                      │
                                                      ├──► Delivery (poId)
                                                      ├──► Invoice (poId)
                                                      └──► ThreeWayMatch (poId, deliveryId, invoiceId)
```

**Enforcement rules:**
- RFQ optionally stores `requisitionId` when created from an approved requisition.
- PO **must** reference an **Awarded** RFQ; only **one non-rejected PO** per RFQ.
- PO vendor and amount **must match** the winning bid.
- Invoice validation requires at least one **Delivered** delivery for the PO.

---

## 4. Workflow 0 — Vendor Onboarding

**Prerequisite for bidding.** Vendors cannot submit bids until verified.

### States

```
User:     PENDING_APPROVAL ──► APPROVED ──► (login enabled)
Vendor:   Pending ──► Verified ──► (can bid)
          │              │
          │              └──► Suspended / Blacklisted (manual, officer)
          │
          └──► (blocked from bidding)
```

### Step-by-step

| Step | Actor | Action | API | Result |
|------|-------|--------|-----|--------|
| 0.1 | Vendor | Self-register | `POST /api/auth/register` | User created: `VENDOR_ADMIN`, `accountLocked=true`, `PENDING_APPROVAL` |
| 0.2 | Admin | Approve vendor user | `POST /api/auth/vendor-approvals/{userId}/approve` | Account unlocked |
| 0.3 | Vendor | First login → init profile | `POST /api/vendors/init-profile` | Stub vendor: `complianceStatus=Pending` |
| 0.4 | Vendor | Upload compliance documents | `POST /api/vendors/{id}/documents` | Documents stored |
| 0.5 | Officer | Verify vendor | `POST /api/vendors/{id}/verify` | `complianceStatus=Verified` |
| 0.6 | System | Publish event | Kafka: `vendor.verified` | Notification sent to vendor |

### Gates

- **Bid submission** checks `complianceStatus == "Verified"` via REST call to vendor-service.
- Only **Verified** vendors appear in RFQ notification emails.

### UI

- Registration: `/vendor-register`
- Vendor dashboard: `/dashboard/vendor`
- Officer vendor management: `/vendors`

---

## 5. Workflow 1 — Purchase Requisition

**Service:** `procurement-service`  
**Purpose:** Internal authorization to spend budget before any vendor engagement.

### Entity

```
PurchaseRequisition {
  requisitionId, requisitionNumber, tenantId
  requesterId, department, justification, estimatedBudget
  status, currentApprovalLevel
  items[]          // RequisitionItem: name, qty, unit price, category
  approvalHistory[] // immutable audit trail
}
```

### Status machine

```
                    submit
    ┌─────────┐ ──────────────► ┌───────────────────┐
    │  DRAFT  │                 │ PENDING_APPROVAL  │
    └─────────┘                 └─────────┬─────────┘
         ▲                                │
         │ reject (revise)                │ multi-level approve
         │                                ▼
    ┌─────────┐                    ┌───────────┐
    │ REJECTED│◄── reject ────────│  APPROVED  │
    └─────────┘                    └───────────┘
```

**Allowed transitions** (enforced by `RequisitionStatus`):

| From | To |
|------|-----|
| `DRAFT` | `PENDING_APPROVAL` |
| `PENDING_APPROVAL` | `APPROVED`, `REJECTED` |
| `REJECTED` | `DRAFT` (revise and resubmit) |

### Multi-level approval (budget-driven)

| Estimated budget | Levels required | Approver at each level |
|------------------|-----------------|------------------------|
| ≤ $10,000 | 1 | Level 1: **MANAGER** |
| > $10,000 and ≤ $50,000 | 2 | L1: MANAGER → L2: **DIRECTOR** |
| > $50,000 | 3 | L1: MANAGER → L2: DIRECTOR → L3: **ADMIN** |

**Rules:**
- Approver role must match `currentApprovalLevel` (SUPER_ADMIN bypasses).
- Same approver cannot approve the same level twice.
- Rejection at any level → `REJECTED` (terminal until revised).

### APIs

| Method | Endpoint | Roles | Description |
|--------|----------|-------|-------------|
| POST | `/api/procurement/requisitions` | REQUESTER, OFFICER, MANAGER, ADMIN | Create (status = `DRAFT`) |
| POST | `/api/procurement/requisitions/{id}/submit` | Requester + above | Submit for approval |
| POST | `/api/procurement/requisitions/{id}/approve` | MANAGER, DIRECTOR, ADMIN | Approve or reject |
| GET | `/api/procurement/requisitions/my-requisitions` | Authenticated | Requester's own requisitions |

### UI

- Page: `/requisitions`
- Create dialog → saves as **Draft**
- **Submit for Approval** button on draft rows
- Approvers see Approve/Reject only when `currentApprovalLevel` matches their role
- Approved requisitions can pre-fill RFQ creation (officer selects requisition in RFQ dialog)

---

## 6. Workflow 2 — Request for Quotation (RFQ)

**Service:** `rfq-bidding-service`  
**Purpose:** Formal invitation for verified vendors to quote on a requirement.

### Entity

```
RFQ {
  rfqId, tenantId, title, description, deadline
  status, createdBy, estimatedValue, categoryId, expectedQuantity
  requisitionId    // optional link back to approved requisition
}
```

### Status machine

```
    create
      │
      ▼
   ┌──────┐   close / deadline   ┌────────┐   award    ┌─────────┐
   │ Open │ ─────────────────────► │ Closed │ ─────────► │ Awarded │
   └──┬───┘                        └────────┘            └─────────┘
      │ cancel
      ▼
  ┌───────────┐
  │ Cancelled │
  └───────────┘
```

| Status | Meaning |
|--------|---------|
| `Open` | Accepting bids until deadline |
| `Closed` | Deadline passed or manually closed; ready for evaluation |
| `Awarded` | Winning bid selected; terminal for sourcing |
| `Cancelled` | RFQ withdrawn (not allowed after award) |

**Scheduler:** Every 5 minutes, open RFQs past deadline auto-close.

### APIs

| Method | Endpoint | Roles | Description |
|--------|----------|-------|-------------|
| POST | `/api/rfqs` | OFFICER, ADMIN | Create RFQ (`Open`); optional `requisitionId` |
| PUT | `/api/rfqs/{id}` | OFFICER, ADMIN | Update (only while `Open`) |
| POST | `/api/rfqs/{id}/close` | OFFICER, ADMIN | Close manually |
| POST | `/api/rfqs/{id}/cancel` | OFFICER, ADMIN | Cancel (not if awarded) |
| GET | `/api/rfqs/{id}/winning-bid` | OFFICER, ADMIN | Get awarded bid (used by PO creation) |

### Events

- `rfq.published` → notification-service emails matching verified vendors

### UI

- Page: `/rfq`
- Create RFQ dialog: optional pre-fill from **approved requisition** (persists `requisitionId`)
- Vendors see open RFQs cross-tenant (buyer tenant publishes, vendor tenant bids)

---

## 7. Workflow 3 — Bidding & Evaluation

**Service:** `rfq-bidding-service` (+ scoring-service for vendor history)

### Entity

```
Bid {
  bidId, rfqId, vendorId, bidAmount, proposalText, deliveryDays
  status, totalScore, qualityScore, submittedAt
}
```

### Bid status machine

```
submit                    evaluate              award (winner)     award (others)
  │                          │                      │                  │
  ▼                          ▼                      ▼                  ▼
Submitted ──────────────► Evaluated ──────────► Awarded          Rejected
(legacy: Pending)              │                      │
                               │                      └──► RFQ → Awarded
                               └──► (scores persisted)
```

| Status | Meaning |
|--------|---------|
| `Submitted` | Vendor bid received (active) |
| `Evaluated` | Scored by officer; not yet awarded |
| `Awarded` | Winning bid |
| `Rejected` | Non-winning bid after award |
| `Withdrawn` | Pulled (e.g. tenant suspension) |

### Submission rules

- RFQ must be `Open` and before deadline.
- Vendor must be `Verified`.
- `vendorId` resolved from authenticated user profile (not trusted from request body).

### Evaluation scoring formula

Weighted score (0–100):

| Factor | Weight | Source |
|--------|--------|--------|
| Timeliness | 35% | Shorter `deliveryDays` = higher score |
| Quality | 35% | Vendor performance history (scoring-service REST) |
| Cost | 20% | Relative to lowest bid on RFQ |
| Responsiveness | 10% | Vendor performance history |

**Evaluation rules:**
- Cannot evaluate before RFQ deadline unless RFQ is `Closed` or `Awarded`.
- `POST /api/bids/rfq/{rfqId}/evaluate-all` evaluates all `Submitted`/`Pending` bids.
- `awardBid` auto-evaluates if no scores exist yet.

### Award rules

- Sets winning bid → `Awarded`, RFQ → `Awarded`.
- Bulk-rejects all other bids on the RFQ.
- Does **not** auto-create PO — officer creates PO separately.

### APIs

| Method | Endpoint | Roles |
|--------|----------|-------|
| POST | `/api/bids` | VENDOR_*, OFFICER |
| POST | `/api/bids/{id}/evaluate` | OFFICER, ADMIN |
| POST | `/api/bids/rfq/{rfqId}/evaluate-all` | OFFICER, ADMIN |
| POST | `/api/bids/{id}/award` | OFFICER, ADMIN |
| GET | `/api/bids/rfq/{rfqId}/ranked` | Internal roles |

### Events

- `bid.submitted` → notification-service, scoring-service (responsiveness boost)

### UI

- `/rfq` → View Bids tab, Evaluate All, Award Contract (RFQ must be Closed/Evaluating)
- Post-award: optional inline PO generation dialog

---

## 8. Workflow 4 — Purchase Order (PO)

**Service:** `procurement-service`  
**Purpose:** Legal/financial commitment to a specific vendor at an agreed price.

### Entity

```
PurchaseOrder {
  poId, tenantId, rfqId, requisitionId, bidId
  vendorId, totalAmount, status
  issueDate, expectedDeliveryDate, approvedBy, createdBy
}
```

### Status machine

```
create                    approve              delivery sync
  │                          │                      │
  ▼                          ▼                      ▼
Draft ──► Pending Approval ──► Approved ──► Delivered ──► Closed
  │              │                │
  │              └── reject       └──► Rejected
  └── auto-approve (< $10k threshold)
```

**Allowed transitions** (enforced by `PurchaseOrderStatus`):

| From | To |
|------|-----|
| `Draft` | `Pending Approval`, `Approved`, `Rejected` |
| `Pending Approval` | `Approved`, `Rejected` |
| `Approved` | `Delivered`, `Closed`, `Rejected` |
| `Delivered` | `Closed` |

### Creation validation

Before a PO is saved, the system verifies:

1. RFQ exists and status is **`Awarded`**.
2. No existing non-rejected PO for this RFQ.
3. Winning bid exists (`GET /api/rfqs/{id}/winning-bid`).
4. `vendorId` and `totalAmount` match the winning bid.
5. `requisitionId` and `bidId` copied from RFQ / winning bid.

### PO approval thresholds

| PO amount | Behavior |
|-----------|----------|
| < $10,000 | Auto-approved on create |
| $10,000 – $49,999 | `Pending Approval` → **MANAGER** or **ADMIN** approves |
| ≥ $50,000 | `Pending Approval` → **DIRECTOR** or **ADMIN** approves |

Configurable via `approval.threshold.manager` and `approval.threshold.director` in procurement-service.

### APIs

| Method | Endpoint | Roles |
|--------|----------|-------|
| POST | `/api/purchase-orders` | OFFICER, ADMIN |
| POST | `/api/purchase-orders/{id}/approve` | MANAGER, DIRECTOR, ADMIN |
| POST | `/api/purchase-orders/{id}/reject` | MANAGER, DIRECTOR, ADMIN |
| PUT | `/api/purchase-orders/{id}/status` | OFFICER, MANAGER, ADMIN |

### Events

- `po.approved` → notification-service, inventory-service
- `approval.pending` → notification-service (when PO needs approval)

### UI

- `/procurement` — PO approval tabs (Pending / Approved / Rejected)
- `/orders` — fulfillment view for vendors and officers
- PO dialog requires **Awarded** RFQ selection

---

## 9. Workflow 5 — Delivery & Receipt

**Service:** `delivery-invoice-service`  
**Purpose:** Record that goods/services were received against an approved PO.

### Entity

```
Delivery {
  deliveryId, poId, tenantId
  expectedDate, actualDate, quantityDelivered
  deliveryStatus, delayDays, issueNotes,
  qualityRating (ACCEPTED | ACCEPTED_WITH_ISSUES | REJECTED),
  qualityIssueTypes (comma-separated codes), qualityRemarks (audit only)
}
```

### Delivery statuses

| Status | Meaning |
|--------|---------|
| `Pending` | Scheduled, not yet shipped |
| `Shipped` | In transit |
| `In Transit` | In transit (alias) |
| `Delivered` | Goods received — triggers PO sync + scoring |
| `Cancelled` | Delivery cancelled |

### Two paths (both sync PO on Delivered)

| Path | API | PO updated? | Kafka event? |
|------|-----|-------------|--------------|
| Create delivery (UI default) | `POST /api/deliveries` | Yes → `Delivered` | `delivery.completed` |
| Update status | `PUT /api/deliveries/{id}/status?status=Delivered` | Yes → `Delivered` | `delivery.completed` |

When status becomes `Delivered`:
1. REST call to procurement-service: PO status → **`Delivered`** (PUT).
2. Kafka event `delivery.completed` published with vendor, delay, quality data.

### APIs

| Method | Endpoint | Roles |
|--------|----------|-------|
| POST | `/api/deliveries` | OFFICER, VENDOR_* |
| PUT | `/api/deliveries/{id}/status` | OFFICER, VENDOR_ADMIN, VENDOR_FINANCE |
| GET | `/api/deliveries/po/{poId}` | All authenticated |

### UI

- `/deliveries` — log delivery, mark delivered
- `/orders` — "Log Delivery Receipt" shortcut

---

## 10. Workflow 6 — Invoice & 3-Way Match

**Service:** `delivery-invoice-service`  
**Purpose:** Vendor billing and validation that invoice matches PO and delivery.

### Entity

```
Invoice {
  invoiceId, poId, vendorId, invoiceAmount, status
  invoiceDate, discrepancyFlag, discrepancyReason
}

ThreeWayMatch {
  poId, deliveryId, invoiceId
  poAmount, poQuantity, invoiceAmount, deliveryQuantity
  quantityMatch, priceMatch, status  // MATCHED | MISMATCH
}
```

### Invoice status machine

```
submit                3-way match OK        manual (external payment)
  │                        │                        │
  ▼                        ▼                        ▼
Pending ──────────────► Approved ──────────────► Paid
  │                        │
  │ dispute / mismatch     └──► Disputed ──► (resolve) ──► Approved / Rejected
  └──────────────────────────────► Disputed
```

**Allowed transitions** (enforced by `InvoiceStatus`):

| From | To |
|------|-----|
| `Pending` | `Approved`, `Disputed`, `Rejected` |
| `Approved` | `Paid`, `Disputed` |
| `Disputed` | `Approved`, `Rejected` |

### 3-way match logic

Compares three documents:

```
PO amount/qty  ↔  Delivery quantity  ↔  Invoice amount
```

| Result | Invoice status | Event |
|--------|----------------|-------|
| All match | `Approved` | — |
| Mismatch | `Disputed` | `invoice.discrepancy` |

**Prerequisite:** At least one `Delivered` delivery must exist for the PO before invoice approval.

### APIs

| Method | Endpoint | Roles |
|--------|----------|-------|
| POST | `/api/invoices` | VENDOR_*, OFFICER |
| POST | `/api/threewaymatch/validate` | OFFICER, ADMIN |
| POST | `/api/invoices/{id}/validate` | OFFICER, ADMIN |
| POST | `/api/invoices/{id}/dispute` | VENDOR_*, OFFICER |

### UI

- `/invoices` — vendor submits invoice; officer runs **Validate** (3-way match dialog)

---

## 11. Workflow 7 — Payment (Manual)

**No accounts-payable integration.** Payment happens outside the system (bank transfer, cheque, etc.). An authorized user records completion manually.

### Flow

```
Invoice: Approved  ──►  (payment received externally)  ──►  Mark Paid  ──►  Invoice: Paid
```

### Who can mark paid

- **OFFICER**, **MANAGER**, **ADMIN**, **SUPER_ADMIN**

### API

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/invoices/{id}/mark-paid` | Sets status to `Paid`; publishes `invoice.paid` |

### Events

- `invoice.paid` → scoring-service (vendor cost/reliability boost)

### UI

- `/invoices` → **Mark Paid** button on Approved invoices

---

## 12. Workflow 8 — Disputes

**Service:** `delivery-invoice-service`  
**Purpose:** Structured resolution when PO, delivery, and invoice do not align.

### Dispute status

```
raise ──► OPEN ──► resolve ──► RESOLVED
```

### Resolution outcomes (explicit — no keyword guessing)

When resolving a dispute linked to an invoice, the officer must specify:

| Outcome | Invoice result |
|---------|------------------|
| `APPROVE_INVOICE` | Invoice → `Approved` |
| `REJECT_INVOICE` | Invoice → `Rejected` |

### APIs

| Method | Endpoint | Roles |
|--------|----------|-------|
| POST | `/api/disputes` | OFFICER, VENDOR_* |
| POST | `/api/disputes/{id}/resolve` | OFFICER, MANAGER, DIRECTOR, ADMIN |

**Resolve body:**
```json
{
  "resolution": "Vendor issued corrected invoice for partial shipment.",
  "outcome": "APPROVE_INVOICE"
}
```

### Events

- `dispute.raised` → notification-service
- `dispute.resolved` → notification-service

### UI

- `/invoices` → Raise Dispute / Resolve Dispute dialogs

---

## 13. Workflow 9 — Vendor Performance Scoring

**Service:** `scoring-service`  
**Purpose:** Track vendor reliability for future bid evaluation.

### Score components

| Metric | Weight | Updated by |
|--------|--------|------------|
| Timeliness | 35% | `delivery.completed` (delay vs expected) |
| Quality | 35% | Delivery quality remarks |
| Cost | 20% | Historical + `invoice.paid` boost |
| Responsiveness | 10% | `bid.submitted` + historical |

### Risk levels

| Overall score | Risk |
|---------------|------|
| ≥ 80 | Low |
| 60–79 | Medium |
| < 60 | High |

### Kafka consumers

| Topic | Effect |
|-------|--------|
| `delivery.completed` | Full score recalculation |
| `bid.submitted` | Responsiveness boost |
| `invoice.paid` | Cost/payment reliability boost |
| `invoice.discrepancy` | Logged; penalizes on next delivery recalc |

### APIs

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/scores/ranking` | All vendors ranked |
| GET | `/api/scores/vendor/{id}/performance` | KPI breakdown |
| POST | `/api/scores/calculate/{vendorId}` | Manual recalculation |
| POST | `/api/scores/recalculate-all` | Bulk recalculation |

### UI

- `/vendors/performance` — rankings, radar charts, recalculate

---

## 14. Event-Driven Integration (Kafka)

```
PRODUCER                    TOPIC                    CONSUMERS
─────────────────────────────────────────────────────────────────
vendor-service              vendor.verified          notification-service
rfq-bidding-service         rfq.published            notification-service
rfq-bidding-service         bid.submitted            notification-service, scoring-service
procurement-service         po.approved              notification-service, inventory-service
procurement-service         approval.pending         notification-service
delivery-invoice-service    delivery.completed       notification-service, scoring-service, inventory-service
delivery-invoice-service    invoice.discrepancy      notification-service, scoring-service
delivery-invoice-service    invoice.paid             scoring-service
delivery-invoice-service    dispute.raised           notification-service
delivery-invoice-service    dispute.resolved         notification-service
scoring-service             score.updated            notification-service
auth-service                tenant.suspended         rfq-bidding-service (cancel RFQs, withdraw bids)
```

---

## 15. API Quick Reference

### End-to-end sequence (happy path)

```
1.  POST /api/procurement/requisitions              → DRAFT
2.  POST /api/procurement/requisitions/{id}/submit  → PENDING_APPROVAL
3.  POST /api/procurement/requisitions/{id}/approve → APPROVED (per level)
4.  POST /api/rfqs                                 → Open RFQ (requisitionId optional)
5.  POST /api/bids                                 → Submitted bid
6.  POST /api/rfqs/{id}/close                      → Closed
7.  POST /api/bids/rfq/{rfqId}/evaluate-all        → Evaluated bids
8.  POST /api/bids/{id}/award                      → Awarded
9.  POST /api/purchase-orders                      → PO (validated against winning bid)
10. POST /api/purchase-orders/{id}/approve         → Approved (if over threshold)
11. POST /api/deliveries                           → Delivered (+ PO sync)
12. POST /api/invoices                             → Pending invoice
13. POST /api/threewaymatch/validate                → Approved or Disputed
14. POST /api/invoices/{id}/mark-paid               → Paid
```

---

## 16. Frontend Routes by Role

| Route | REQUESTER | OFFICER | MANAGER | DIRECTOR | VENDOR | AUDITOR |
|-------|-----------|---------|---------|----------|--------|---------|
| `/requisitions` | Create, submit | Create, RFQ link | Approve L1 | Approve L2 | — | Read |
| `/rfq` | — | Full | Read | Read | Bid | Read |
| `/procurement` | — | Create PO | Approve PO | Approve PO | — | Read |
| `/orders` | — | Read | Read | Read | Own POs | Read |
| `/deliveries` | — | Manage | Read | Read | Log/update | Read |
| `/invoices` | — | Validate, mark paid | Mark paid | Read | Submit | Read |
| `/vendors` | — | Verify | Read | Read | Profile | Read |
| `/vendors/performance` | — | Full | Read | Read | Own score | Read |

**Dashboards by role:**
- `/dashboard/officer`, `/dashboard/manager`, `/dashboard/director`, `/dashboard/vendor`, `/dashboard/auditor`, `/dashboard/admin`
- REQUESTER uses `/requisitions` as home

---

## 17. Demo Accounts

Default tenant (`default`), password shown for local/dev seed data:

| Email | Password | Role |
|-------|----------|------|
| `admin@procurement.com` | `admin123` | ADMIN |
| `alice@procurement.com` | `officer123` | OFFICER (+ `VENDOR_SALES` supplier role — dual-hat demo) |
| `carol@procurement.com` | `manager123` | MANAGER |
| `director@procurement.com` | `director123` | DIRECTOR |
| `requester@procurement.com` | `requester123` | REQUESTER |
| `eve@procurement.com` | `auditor123` | AUDITOR |
| `vendor1@techsupply.com` | `vendor123` | VENDOR_ADMIN |
| `superadmin@system.local` | `SuperAdmin@123` | SUPER_ADMIN |

---

## Appendix: Configuration Thresholds

| Setting | Default | Service |
|---------|---------|---------|
| PO manager approval threshold | $10,000 | procurement-service |
| PO director approval threshold | $50,000 | procurement-service |
| Requisition L1 threshold | ≤ $10,000 | procurement-service |
| Requisition L2 threshold | > $10,000 | procurement-service |
| Requisition L3 threshold | > $50,000 | procurement-service |
| JWT expiration | 8 hours | auth-service |
| RFQ auto-close scheduler | Every 5 min | rfq-bidding-service |

---

*For architecture and deployment details, see `docs/00-overview.md`, `docs/01-architecture.md`, and `docs/08-infrastructure-and-deployment.md`.*
