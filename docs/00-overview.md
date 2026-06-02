# ProcurePro — System Overview

> **Who should read this:** Anyone new to the project — developer, stakeholder, or reviewer — who needs a clear picture of what this system does, why it was built this way, and how the pieces fit together before diving into code.

---

## What Is ProcurePro?

ProcurePro is a **Procurement Management System (PMS)** — software that automates and governs how an organisation buys goods and services from external suppliers (vendors).

In manual procurement, a company employee who needs to purchase something sends an email, waits for manager approvals, contacts suppliers by phone, receives paper invoices, and manually cross-checks that what was ordered matches what was delivered and what was charged. This process is slow, error-prone, and nearly impossible to audit.

ProcurePro replaces all of that with a structured digital workflow:

1. An employee creates a **Purchase Requisition** — a formal request to buy something.
2. A manager **approves** the requisition.
3. A procurement officer creates a **Request for Quotation (RFQ)** — asking multiple vendors to bid on the contract.
4. Vendors **submit bids**; the system scores them automatically.
5. The best bid is **awarded** and a **Purchase Order (PO)** is issued.
6. The vendor **delivers** goods; delivery is recorded.
7. The vendor submits an **invoice**; the system performs **3-way matching** (PO amount = delivery quantity = invoice amount).
8. If everything matches, the invoice is approved for payment. Discrepancies trigger a **dispute** process.
9. Throughout all of this, every action is logged, every vendor is scored on performance, and analytics dashboards give management real-time visibility.

---

## Who Uses It?

The system supports **seven distinct user roles**, each with a different view and different permissions:

| Role | Who They Are | What They Do |
|---|---|---|
| **SUPER_ADMIN** | System-level administrator | Manages tenants, creates admins, has cross-organisation access |
| **ADMIN** | Organisation-level administrator | Full control within their organisation |
| **OFFICER** | Procurement officer | Creates RFQs, manages vendors, creates POs |
| **MANAGER** | Department/procurement manager | Approves POs and requisitions |
| **DIRECTOR** | Senior executive | High-level oversight, approvals, analytics |
| **AUDITOR** | Compliance/audit staff | Read-only access to everything for oversight |
| **VENDOR** | External supplier | Submits bids, tracks their own orders, uploads documents |

---

## Multi-Tenancy: One System, Many Organisations

ProcurePro is designed as a **multi-tenant SaaS platform** — a single deployed instance can serve many independent organisations simultaneously. Each organisation is a **tenant** with its own isolated data, users, and settings.

Think of it like Gmail: Google runs one email system, but your inbox is completely separate from everyone else's. In ProcurePro, your company's purchase orders are never visible to another company's users, even though they both run on the same database server.

**Why multi-tenancy instead of deploying a separate copy per organisation?**
- Cost: one deployment to maintain, one set of servers to pay for.
- Upgrades: one deployment to update pushes changes to all organisations at once.
- Operational simplicity: one monitoring setup, one log stream, one place to fix bugs.

---

## The 10 Services at a Glance

The system is split into **10 independent backend services** plus a **web frontend**:

| Service | What It Does |
|---|---|
| **api-gateway** | Single entry point for all HTTP requests; validates JWTs, routes traffic, enforces rate limits |
| **auth-service** | Handles login, registration, user management, tenant management, roles/permissions |
| **vendor-service** | Manages the vendor registry — companies that can bid on contracts |
| **rfq-bidding-service** | Manages Requests for Quotation and vendor bid submissions |
| **procurement-service** | Manages purchase requisitions and purchase orders with approval workflows |
| **delivery-invoice-service** | Records deliveries, validates invoices, runs 3-way matching, handles disputes |
| **scoring-service** | Automatically scores vendor performance based on delivery, quality, and price |
| **inventory-service** | Tracks stock levels and triggers reorder requests when stock runs low |
| **notification-service** | Sends in-app and email notifications when important events happen |
| **analytics-service** | Aggregates data from all services to produce dashboards and reports |
| **frontend** | The web application users interact with (Next.js) |

---

## The Full Procurement Lifecycle

```
[Employee]                [Officer]               [Vendor]               [Manager/Director]
     |                        |                       |                          |
     |-- Create Requisition -->|                       |                          |
     |                        |-- Approve/Reject ----> back to employee           |
     |                        |                                                  |
     |                        |-- Create RFQ --------> Published to all vendors  |
     |                        |                       |                          |
     |                        |                       |-- Submit Bids ---------->|
     |                        |                       |                          |
     |                        |<-- System scores bids automatically              |
     |                        |-- Award RFQ, create PO -----------------------> |
     |                                                                           |-- Approve PO
     |                        [Vendor notified of PO award]
     |                        [Vendor ships goods]
     |                        |<-- Record Delivery                               |
     |                        |<-- Submit Invoice                                |
     |                        |                                                  |
     |                        |-- 3-way match: PO ↔ Delivery ↔ Invoice -------> |
     |                        |                                                  |
     |                        |-- Match OK → Invoice approved for payment        |
     |                        |-- Mismatch → Dispute raised → Resolved           |
     |                                                                           |
     |   [Scoring service updates vendor performance record]
     |   [Analytics service reflects new spend data]
     |   [Inventory adjusted if goods tracked in inventory]
```

---

## Technology Choices at a Glance

| Layer | Technology | Why |
|---|---|---|
| Backend services | Spring Boot 3.2 (Java 21) | Mature, production-proven, excellent ecosystem for enterprise patterns |
| Frontend | Next.js 14 (React + TypeScript) | Full-stack React framework with server-side rendering capability |
| Database | PostgreSQL (one per service) | Reliable relational DB; multi-tenancy via row-level filtering |
| Message queue | Apache Kafka | High-throughput durable event streaming for cross-service communication |
| Cache | Redis (one per service) | Fast in-memory key-value store for reducing DB load |
| Service mesh | Spring Cloud Gateway | Handles routing, JWT validation, and rate limiting at the edge |
| Containerisation | Docker + Docker Compose | Reproducible local dev and deployment |

Each of these choices is explained in depth in the relevant documentation files.

---

## Where to Go Next

| Topic | File |
|---|---|
| How the services communicate and why microservices | [01-architecture.md](01-architecture.md) |
| Login, JWT, roles, permissions, multi-tenancy | [02-authentication-and-security.md](02-authentication-and-security.md) |
| Full procurement workflow step by step | [03-procurement-workflow.md](03-procurement-workflow.md) |
| Vendor management, documents, scoring | [04-vendor-management.md](04-vendor-management.md) |
| Kafka events, async processing, notifications | [05-event-driven-design.md](05-event-driven-design.md) |
| Database design, Redis caching, data isolation | [06-data-and-caching.md](06-data-and-caching.md) |
| Frontend: Next.js, state, API client | [07-frontend.md](07-frontend.md) |
| Docker, environment variables, deployment | [08-infrastructure-and-deployment.md](08-infrastructure-and-deployment.md) |
