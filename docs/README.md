# ProcurePro Documentation

Technical and workflow documentation for the ProcurePro Procurement Management System.
Written for software engineers joining the project or reviewing the codebase.

---

## Reading Order

Start with the overview, then follow your area of interest:

| # | File | What You'll Learn |
|---|---|---|
| 0 | [00-overview.md](00-overview.md) | What the system does, who uses it, technology summary |
| 1 | [01-architecture.md](01-architecture.md) | Why microservices, how services communicate, API gateway, database isolation |
| 2 | [02-authentication-and-security.md](02-authentication-and-security.md) | JWT, multi-tenancy, roles, permissions, BCrypt, CORS |
| 3 | [03-procurement-workflow.md](03-procurement-workflow.md) | Full lifecycle: Requisition → RFQ → Bid → PO → Delivery → Invoice → 3-way match |
| 4 | [04-vendor-management.md](04-vendor-management.md) | Vendor lifecycle, document uploads, scoring algorithm |
| 5 | [05-event-driven-design.md](05-event-driven-design.md) | Kafka topics, why async, notification service, retry/DLT |
| 6 | [06-data-and-caching.md](06-data-and-caching.md) | PostgreSQL design, indexes, optimistic locking, Redis strategy |
| 7 | [07-frontend.md](07-frontend.md) | Next.js App Router, Zustand auth store, API client, role-based UI |
| 8 | [08-infrastructure-and-deployment.md](08-infrastructure-and-deployment.md) | Docker Compose, environment variables, Kubernetes, production checklist |

---

## Quick Reference

**Services and ports:**
```
api-gateway         :8080
auth-service        :8081  → postgres-auth:5432
vendor-service      :8082  → postgres-vendor:5433
rfq-bidding-service :8083  → postgres-rfq:5434
procurement-service :8084  → postgres-procurement:5435
delivery-invoice    :8085  → postgres-delivery:5436
scoring-service     :8086  → postgres-scoring:5437
analytics-service   :8087  → Redis only (no DB)
inventory-service   :8088  → postgres-inventory:5438
notification-service:8089  → postgres-notification:5439
frontend            :3000
```

**Kafka topics:**
```
vendor.verified      → notification-service
rfq.published        → notification-service
bid.submitted        → notification-service, scoring-service
po.approved          → notification-service
delivery.completed   → notification-service, scoring-service
invoice.discrepancy  → notification-service, scoring-service
score.updated        → (available, not yet consumed)
```

**Default dev login:**
```
Email:    admin@procurepro.com
Password: Admin@123
Role:     SUPER_ADMIN
```
