# Procurement Workflow — From Requisition to Delivery

> **Who should read this:** Developers implementing or debugging any part of the procurement pipeline, and anyone who needs to understand the business logic behind the system's workflows.

---

## The Full Workflow at a Glance

```
STEP 1: Purchase Requisition (procurement-service)
  Employee creates a request to buy something
  ↓ approval
STEP 2: Request for Quotation (rfq-bidding-service)
  Officer publishes an RFQ to invite vendor bids
  ↓ vendors submit bids
STEP 3: Bid Evaluation & Award (rfq-bidding-service + scoring-service)
  System scores bids; officer awards the best one
  ↓
STEP 4: Purchase Order (procurement-service)
  Officer creates a PO from the awarded bid
  ↓ manager/director approval
STEP 5: Delivery (delivery-invoice-service)
  Vendor ships goods; officer records the delivery
  ↓
STEP 6: Invoice & 3-Way Match (delivery-invoice-service)
  Vendor submits invoice; system validates it matches PO and delivery
  ↓
STEP 7: Payment / Dispute Resolution
  Matched invoices go for payment; mismatches raise disputes
```

Each step is a state transition with specific roles that can trigger it. The entire chain is linked by IDs: `RFQ → Bid → PO → Delivery → Invoice → ThreeWayMatch`.

---

## Step 1: Purchase Requisition

**Service:** `procurement-service`  
**Entity:** `PurchaseRequisition`  
**Who can create:** Any user (OFFICER, MANAGER, EMPLOYEE)

### What It Is

A Purchase Requisition is an internal document saying "we need to buy X". It is not a commitment to any vendor — it's an approval request to authorise the budget and intent to purchase.

### Entity Structure

```java
PurchaseRequisition {
    requisitionId       // PK
    tenantId            // Multi-tenancy
    requisitionNumber   // Human-readable ID (e.g., "REQ-2024-001")
    requesterId         // Who created it (userId)
    department          // Which department needs the goods
    justification       // Business reason for the purchase
    estimatedBudget     // Expected total cost
    status              // DRAFT → SUBMITTED → APPROVED → REJECTED
    currentApprovalLevel // For multi-level approval tracking
    items[]             // List of items being requested (RequisitionItem)
    approvalHistory[]   // Immutable record of all approval decisions
}

RequisitionItem {
    itemName, description
    quantity, unit
    estimatedUnitPrice
    category
}
```

### Approval Workflow

```
Officer creates → DRAFT
Officer submits → SUBMITTED
Manager approves Level 1 → moves to Level 2 (if configured)
Director approves Level 2 → APPROVED
```

`ApprovalHistory` records each decision:
```java
ApprovalHistory {
    approvalLevel       // 1, 2, 3...
    approvedBy          // userId of the approver
    decision            // "APPROVED" | "REJECTED"
    comments            // Optional justification
    approvalDate
}
```

**Why store approval history?** For auditing. If a requisition is later disputed ("who approved this?"), the system has an immutable record. The AUDITOR role can query all approval histories.

### Converting a Requisition to an RFQ

Once APPROVED, the system allows an OFFICER to initiate an RFQ process. The frontend shows a "Convert to PO" shortcut that pre-fills the RFQ with the requisition's item details and budget.

---

## Step 2: Request for Quotation (RFQ)

**Service:** `rfq-bidding-service`  
**Entity:** `RFQ`  
**Who can create:** OFFICER, ADMIN

### What It Is

An RFQ is a formal invitation to vendors to submit a price quote for a specific requirement. It is published openly — any registered vendor in the system can see open RFQs and submit a bid.

### Entity Structure

```java
RFQ {
    rfqId
    tenantId
    title               // e.g., "Office Supplies Q4 2024"
    description         // Detailed requirements (TEXT — unlimited length)
    deadline            // When bids close (LocalDateTime)
    status              // "Open" | "Closed" | "Awarded"
    createdBy           // Officer's userId
    estimatedValue      // Budget cap (BigDecimal)
    categoryId          // Vendor category (matches vendor expertise)
    expectedQuantity    // How much is needed
    version             // Optimistic locking (prevent concurrent edit conflicts)
}
```

### RFQ Lifecycle

```
POST /api/rfqs → status = "Open"
                → Kafka event: rfq.published
                → Notification service: notifies all vendors in the category

Automatic close:
  @Scheduled(cron = "0 */5 * * * *")  ← runs every 5 minutes
  checkAndCloseExpiredRFQs():
    SELECT rfqs WHERE deadline < NOW() AND status = 'Open'
    → Update status = "Closed"
    → No more bids accepted

Manual award:
  POST /api/bids/{bidId}/award → status = "Awarded"
                               → triggers PO creation
```

**Why a scheduler instead of checking on every request?**

Option A: Check deadline on every bid submission.
- Inconsistent window: an RFQ could be 12 hours past deadline but still accepting bids until someone tries to submit.

Option B: Scheduled job runs periodically.
- Guarantees RFQs close within 5 minutes of their deadline, regardless of whether anyone submits.
- One place for the close logic instead of multiple places.

---

## Step 3: Bid Submission and Evaluation

**Service:** `rfq-bidding-service` (stores bids) + `scoring-service` (calculates scores)  
**Entity:** `Bid`

### Bid Entity

```java
Bid {
    bidId
    tenantId
    rfqId               // Which RFQ this is for
    vendorId            // Which vendor submitted it
    bidAmount           // Price offered (BigDecimal)
    proposalText        // Written proposal (TEXT)
    deliveryDays        // How quickly the vendor can deliver
    qualityScore        // Quality rating (0-100), filled after evaluation
    totalScore          // Weighted composite score (0-100), filled after evaluation
    status              // "Submitted" | "Evaluated" | "Awarded"
    submittedAt
    version             // Optimistic locking
}
```

**Index on (rfqId, totalScore DESC):** This index exists specifically to make the "show bids ranked by score" query fast — fetching the sorted list requires no in-memory sorting.

### How Scoring Works

When an officer clicks "Evaluate Bids", the rfq-bidding-service calls the scoring-service:

```
POST /api/scores/vendor/{vendorId}/performance
  ← Returns: { onTimeDeliveryRate, qualityAverage, priceCompetitiveness, ... }

totalScore = (deliveryScore × weightDelivery)
           + (qualityScore × weightQuality)
           + (priceScore × weightPrice)

riskLevel = totalScore < 40 ? "HIGH" 
           : totalScore < 75 ? "MEDIUM" 
           : "LOW"
```

**Why involve scoring-service here?**
A bid's score isn't just about the bid itself — it considers the vendor's track record. A vendor offering the lowest price but with a history of late deliveries should score lower than a slightly more expensive vendor with perfect delivery. The scoring-service has that historical data.

**Why the fallback?**
For new vendors with no history, the scoring-service returns no records. The rfq-bidding-service falls back to sensible defaults (e.g., 50/100 on historical KPIs) so they can still compete.

### Awarding a Bid

```
POST /api/bids/{bidId}/award
  → Bid status = "Awarded"
  → All other bids for this RFQ: status = "Evaluated" (not awarded)
  → RFQ status = "Awarded"
  → Frontend shows "Congratulations" banner to the winning vendor
```

---

## Step 4: Purchase Order

**Service:** `procurement-service`  
**Entity:** `PurchaseOrder`  
**Who can create:** OFFICER, ADMIN  
**Who can approve:** MANAGER, DIRECTOR, ADMIN

### Entity Structure

```java
PurchaseOrder {
    poId
    tenantId
    rfqId               // Links back to the RFQ that initiated this
    vendorId            // The winning vendor
    totalAmount         // Contract value (BigDecimal — exact arithmetic, no floating point)
    managerId           // Who is responsible
    createdBy           // Officer who created it
    approvedBy          // Manager who approved it
    approvalDate
    status              // "Draft" | "Pending Approval" | "Approved" | "Rejected" | "Cancelled"
    issueDate
    expectedDeliveryDate
    version             // Optimistic locking
}
```

**Why BigDecimal instead of double for money?**
`double` uses binary floating-point arithmetic. `0.1 + 0.2 = 0.30000000000000004` in binary float. For financial amounts this is unacceptable. `BigDecimal` provides exact decimal arithmetic. Always use BigDecimal for money.

### PO Approval Flow

```
Officer creates PO → status = "Draft" or "Pending Approval"

POST /api/purchase-orders/{id}/approve (MANAGER/DIRECTOR/ADMIN only)
  → status = "Approved"
  → Kafka event: po.approved
  → Notification service: emails the vendor with PO details

POST /api/purchase-orders/{id}/reject (MANAGER/DIRECTOR/ADMIN only)
  → status = "Rejected"
  → Officer can revise and resubmit
```

**Why require approval for POs?**
A PO is a legal commitment to spend money. Requiring manager sign-off implements the **segregation of duties** — the person who initiates a purchase cannot also authorise it. This is a standard procurement control to prevent fraud.

---

## Step 5: Delivery

**Service:** `delivery-invoice-service`  
**Entity:** `Delivery`  
**Who can record:** OFFICER, ADMIN  
**Who can mark delivered:** OFFICER, ADMIN (with `deliveries:update` permission)

### Entity Structure

```java
Delivery {
    deliveryId
    tenantId
    poId                // Which PO this delivery is for
    expectedDate        // When it was supposed to arrive
    actualDate          // When it actually arrived
    deliveryStatus      // "Pending" | "Partial" | "Shipped" | "In Transit" | "Completed"
    quantityDelivered   // Actual quantity received
    delayDays           // actualDate - expectedDate (calculated)
    issueNotes          // Notes about problems
    qualityRemarks      // Quality observations
}
```

### Delivery Status Cascade

When the status becomes "Completed" or "Delivered":

```java
// DeliveryService.updateDeliveryStatus()
if (status == "Completed" || status == "Delivered") {
    // 1. Tell procurement service the goods arrived
    procurementClient.updatePOStatus(poId, "Delivered");
    
    // 2. Publish event for scoring and notifications
    kafkaTemplate.send("delivery.completed", DeliveryCompletedEvent {
        deliveryId, poId, vendorId,
        expectedDate, actualDate,
        quantityDelivered, onTime: (delayDays <= 0),
        adminEmail  // for late delivery alerts
    });
}
```

**Why cascade to procurement-service synchronously?**
The PO status ("Approved" → "Delivered") is a business milestone that officers monitor. Updating it synchronously ensures consistency — when you mark a delivery complete, the PO status reflects it immediately in the procurement dashboard.

**Why also publish a Kafka event?**
Because multiple downstream services need to react:
- `scoring-service`: updates the vendor's on-time delivery score.
- `notification-service`: sends a "delivery complete" alert; sends a late-delivery email if `delayDays > 7`.

These reactions are independent and can fail without affecting each other or the delivery record itself. Kafka provides this fan-out capability.

---

## Step 6: Invoice and 3-Way Matching

**Service:** `delivery-invoice-service`  
**Entities:** `Invoice`, `ThreeWayMatch`

### What 3-Way Matching Is

The cornerstone of accounts payable control:

```
PO (what was ordered)
    ↕ compare
Delivery receipt (what was received)
    ↕ compare
Invoice (what vendor is charging)

If all three agree → pay the invoice
If any mismatch → investigate before paying
```

### Invoice Entity

```java
Invoice {
    invoiceId
    tenantId
    poId
    vendorId
    invoiceAmount       // BigDecimal — what vendor says they're owed
    status              // "Draft" | "Submitted" | "Validated" | "Paid" | "Disputed"
    invoiceDate
    discrepancyFlag     // true if mismatch detected
    discrepancyReason   // Text explaining the mismatch
}
```

### ThreeWayMatch Entity

```java
ThreeWayMatch {
    matchId
    tenantId
    poId, deliveryId, invoiceId
    poAmount            // From PO
    invoiceAmount       // From invoice
    poQuantity          // From PO
    deliveryQuantity    // From delivery record
    priceMatch          // invoiceAmount == poAmount (within tolerance)
    quantityMatch       // deliveryQuantity == poQuantity
    status              // "MATCHED" | "MISMATCH" | "PENDING"
    mismatchReason      // e.g., "Invoice amount $5,200 exceeds PO amount $5,000"
    validatedAt
}
```

### Match Validation Flow

```
POST /api/threewaymatch/validate { poId, deliveryId, invoiceId }

Service fetches:
  - PO from procurement-service (amount, quantity)
  - Delivery record (quantityDelivered)
  - Invoice (invoiceAmount)

Compares:
  priceMatch = |invoiceAmount - poAmount| <= tolerance (e.g., 0.01)
  quantityMatch = deliveryQuantity == poQuantity

If both match:
  → ThreeWayMatch.status = "MATCHED"
  → Invoice.status = "Validated"

If mismatch:
  → ThreeWayMatch.status = "MISMATCH"
  → Invoice.status = "Disputed"
  → Invoice.discrepancyFlag = true
  → Kafka event: invoice.discrepancy
  → Notification service: alerts the officer
```

---

## Step 7: Dispute Resolution

**Entity:** `Dispute`  
**Who can resolve:** Users with `disputes:resolve` permission (ADMIN, MANAGER)

### Dispute Entity

```java
Dispute {
    disputeId
    tenantId
    poId, deliveryId, invoiceId  // What the dispute is about
    disputeType         // "PRICE_MISMATCH" | "QUANTITY_MISMATCH" | "QUALITY_ISSUE" | "LATE_DELIVERY"
    description         // Details of the problem
    status              // "Open" | "Resolved" | "Closed"
    resolution          // How it was resolved
    raisedBy            // userId of who created it
    resolvedBy          // userId of who resolved it
}
```

### Resolution Flow

```
Dispute is "Open" →
  POST /api/disputes/{id}/resolve { resolution: "Vendor agreed to credit note for $200" }
  → status = "Resolved"
  → resolvedBy = current userId
  → Invoice can then be manually adjusted and re-validated
```

---

## How the Chain Holds Together

Every step is linked by foreign keys / IDs:

```
RFQ (rfqId)
  └── Bid (bidId → rfqId, vendorId)
        └── PurchaseOrder (poId → rfqId, vendorId)
              ├── Delivery (deliveryId → poId)
              ├── Invoice (invoiceId → poId, vendorId)
              └── ThreeWayMatch (matchId → poId, deliveryId, invoiceId)
                    └── Dispute (disputeId → poId, deliveryId, invoiceId)
```

This chain allows full traceability: given any dispute, you can trace back to exactly which bid, which RFQ, which requisition, and which officer initiated the procurement.

---

## State Machine Summary

| Entity | States | Transitions |
|---|---|---|
| PurchaseRequisition | DRAFT → SUBMITTED → APPROVED → REJECTED | Submit, Approve, Reject |
| RFQ | Open → Closed → Awarded | Auto-close (scheduler), Award |
| Bid | Submitted → Evaluated → Awarded | Evaluate, Award |
| PurchaseOrder | Draft → Pending Approval → Approved → Rejected → Cancelled | Submit, Approve, Reject, Cancel |
| Delivery | Pending → Shipped → In Transit → Completed | Status update |
| Invoice | Draft → Submitted → Validated → Paid → Disputed | Submit, Validate, Dispute |
| ThreeWayMatch | PENDING → MATCHED → MISMATCH | Validate |
| Dispute | Open → Resolved → Closed | Resolve |

Each state transition is an explicit business action. Attempting an invalid transition (e.g., approving an already-approved PO) is caught by service-layer validation.
