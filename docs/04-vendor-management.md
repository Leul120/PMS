# Vendor Management — Lifecycle, Documents, and Scoring

> **Who should read this:** Developers working on vendor-service or scoring-service, and anyone who wants to understand how the system manages external supplier relationships.

---

## The Vendor Lifecycle

A vendor is an external company that can supply goods or services. In ProcurePro, vendors go through a structured lifecycle before they can participate in bids:

```
[Public Internet]
Vendor fills registration form
         ↓
POST /api/auth/register (auth-service)
User created: role=VENDOR, accountLocked=true, status=PENDING_APPROVAL
         ↓
Admin reviews pending approvals
POST /api/auth/vendor-approvals/{userId}/approve
User unlocked, status=APPROVED
         ↓
Vendor logs in → vendor-service creates Vendor profile
         ↓
Vendor uploads compliance documents
         ↓
Officer verifies vendor (reviews documents, background check)
POST /api/vendors/{id}/verify
Vendor.complianceStatus = "Verified"
         ↓
Vendor can now submit bids on open RFQs
         ↓
After contract execution, scoring-service tracks performance
```

---

## The Vendor Entity

**Service:** `vendor-service`

```java
Vendor {
    vendorId            // PK
    tenantId            // Multi-tenant isolation
    userId              // Links to User in auth-service (for authentication)
    companyName         // Legal business name
    contactPerson       // Primary contact name
    email               // Business email
    phoneNumber
    address
    taxId               // Tax identification number (for compliance)
    category            // FK to VendorCategory (what they supply)
    complianceStatus    // "Pending" | "Verified" | "Suspended" | "Blacklisted"
    version             // Optimistic locking (version column prevents lost updates)
}
```

**Why link Vendor to User?**
The `User` table (in auth-service) handles authentication — login, passwords, roles, account locks. The `Vendor` table (in vendor-service) handles business profile — company details, compliance, documents. They're separated because:
1. They belong to different bounded contexts (auth vs. vendor management).
2. A vendor's authentication account can exist independently of their business profile being complete.

**The `userId → vendorId` bridge:** When a VENDOR-role user logs in, the frontend calls `GET /api/vendors/user/{userId}` to find their Vendor profile. If none exists yet, `vendorApi.initProfile()` creates a stub.

---

## Vendor Categories

```java
VendorCategory {
    categoryId
    categoryName    // e.g., "IT Equipment", "Office Supplies", "Catering"
    description
}
```

Categories serve two purposes:
1. **RFQ targeting:** An RFQ for "IT Equipment" notifies vendors in that category, not all vendors.
2. **Analytics grouping:** The compliance report shows vendor count and spend by category.

---

## Document Management

Vendors are required to maintain current compliance documents (certificates, registrations, insurance, etc.).

### VendorDocument Entity

```java
VendorDocument {
    documentId
    vendorId
    documentType    // e.g., "Business Registration", "Tax Certificate", "Insurance"
    fileUrl         // Internal storage path (set by FileStorageService on upload)
    expiryDate      // When the document expires
    uploadDate
}
```

### File Upload Implementation

**Why not store files as base64 in the database?**
Binary data in a relational database:
- Bloats database size massively.
- Prevents efficient streaming — entire file must be loaded into memory before serving.
- Makes database backups much larger and slower.
- Bypasses OS-level file caching that filesystems are optimised for.

Instead, files are stored on disk. Only the file path is in the database.

### FileStorageService

```java
// vendor-service/service/FileStorageService.java
String storeFile(MultipartFile file, Long vendorId) {
    // 1. Validate file type
    allowedTypes = ["application/pdf", "image/png", "image/jpeg", "application/vnd.openxmlformats..."]
    if (!allowedTypes.contains(file.getContentType())) throw new InvalidFileTypeException()

    // 2. Validate file size (10MB max)
    if (file.getSize() > 10 * 1024 * 1024) throw new FileTooLargeException()

    // 3. Generate unique filename (UUID prevents collision and path traversal)
    String filename = UUID.randomUUID() + "." + extension

    // 4. Store in: {FILE_UPLOAD_DIR}/{vendorId}/{filename}
    // FILE_UPLOAD_DIR defaults to "uploads/vendors"
    // In Docker: /app/uploads/vendors (volume-mounted)
    Path targetPath = Paths.get(uploadDir, vendorId.toString(), filename)
    Files.createDirectories(targetPath.getParent())
    Files.copy(file.getInputStream(), targetPath)

    return targetPath.toString()
}
```

**Security note on UUID filenames:**
Using UUIDs instead of original filenames prevents:
- **Path traversal:** A file named `../../../etc/passwd` becomes `550e8400-e29b-...pdf`.
- **Overwriting:** A second upload of `business-reg.pdf` doesn't overwrite the first.
- **Information leakage:** Clients can't infer what other files exist.

### Authenticated File Download

Document files are not publicly accessible. They require a valid JWT:

```java
// VendorController.java
@GetMapping("/documents/{id}/file")
@PreAuthorize("hasAnyRole('ADMIN', 'OFFICER', 'AUDITOR', 'VENDOR')")
public ResponseEntity<Resource> downloadDocument(@PathVariable Long id) {
    VendorDocument doc = vendorService.getDocument(id);
    Path filePath = Paths.get(doc.getFileUrl());
    Resource resource = new UrlResource(filePath.toUri());
    return ResponseEntity.ok()
        .contentType(MediaType.parseMediaType(detectMimeType(filePath)))
        .header("Content-Disposition", "attachment; filename=\"" + filePath.getFileName() + "\"")
        .body(resource);
}
```

```typescript
// Frontend: vendor-document-dialog.tsx
// Cannot use a plain <a href> because the request needs the JWT header.
// Instead: fetch with auth header, create a Blob URL, click it programmatically.
const response = await fetch(`/api/vendors/documents/${id}/file`, {
    headers: { Authorization: `Bearer ${token}` }
});
const blob = await response.blob();
const url = URL.createObjectURL(blob);
// Create temporary link and click it
const a = document.createElement('a');
a.href = url;
a.download = filename;
a.click();
URL.revokeObjectURL(url);  // clean up memory
```

---

## Vendor Verification

Verification is the officer's sign-off that the vendor is legitimate:

```
POST /api/vendors/{id}/verify
  → complianceStatus = "Verified"
  → Kafka event: vendor.verified
  → notification-service: sends approval email to vendor
```

**Before deactivating a verified vendor**, the frontend checks for open POs:

```typescript
// vendors/page.tsx
const openPOs = await poApi.getAll().then(pos =>
    pos.filter(po => po.vendorId === vendor.vendorId && 
                     !["Completed", "Cancelled", "Rejected"].includes(po.status))
);

if (openPOs.length > 0) {
    showWarning(`This vendor has ${openPOs.length} open purchase order(s). 
                 Deactivating may disrupt active procurement.`);
}
```

This prevents accidentally cutting off a vendor mid-contract.

---

## Vendor Scoring

**Service:** `scoring-service`

Vendor scoring is the system's way of building an objective, data-driven record of each vendor's reliability. It feeds back into the bid evaluation process — better-performing vendors score higher on future bids.

### What Is Scored

```java
VendorScore {
    scoreId
    tenantId
    vendorId
    performanceMetric   // "DELIVERY", "QUALITY", "PRICE", "COMPLIANCE"
    weightedScore       // 0-100 BigDecimal
    riskLevel           // "LOW" | "MEDIUM" | "HIGH"
}

VendorPerformanceRecord {
    // Historical records: each delivery, invoice validation, and bid
    // used to calculate rolling averages
}

VendorCompositeScore {
    // Aggregated KPIs into one overall score
    overallScore
    onTimeDeliveryRate  // % of deliveries on or before expected date
    qualityAverage      // Average quality score across all delivered orders
    priceCompetitiveness // How the vendor's bids compare to market average
    complianceScore     // Whether documents are current and verified
}
```

### Scoring Formula

```
totalScore = (onTimeDeliveryRate × weightDelivery)
           + (qualityAverage × weightQuality)
           + (priceCompetitiveness × weightPrice)
           + (complianceScore × weightCompliance)

Weights are configurable via ScoringWeights entity.
Default: delivery 30%, quality 40%, price 20%, compliance 10%

Risk classification:
  totalScore < 40  → HIGH risk
  totalScore < 75  → MEDIUM risk
  totalScore ≥ 75  → LOW risk
```

### What Triggers a Score Update

```
1. delivery.completed Kafka event:
   → Updates onTimeDeliveryRate
   → If actualDate > expectedDate: negative impact on delivery score
   → Updates VendorPerformanceRecord

2. bid.submitted Kafka event:
   → Records bidAmount for price competitiveness analysis
   → Compares to average bid amounts across other vendors for same RFQ

3. invoice.discrepancy Kafka event:
   → Negative impact on quality/compliance score
   → Frequent discrepancies = lower compliance score

4. POST /api/scores/calculate/{vendorId}:
   → Manual trigger (officer can force a recalculation)

5. POST /api/scores/recalculate-all:
   → Batch job (admin can recalculate all vendors after weight changes)
```

### The Scoring Feedback Loop

```
Vendor submits bid
  → bid evaluated (scoring-service provides historical performance KPIs)
  → bid awarded (vendorscore influences totalScore in Bid entity)
  → vendor delivers order
  → delivery.completed event
  → scoring-service updates VendorPerformanceRecord
  → next bid evaluation uses updated history
  → better performers win more contracts (virtuous cycle)
  → poor performers surface as HIGH risk before awarding large contracts
```

### Why Automate Vendor Scoring?

**Manual scoring problems:**
- Inconsistent: different officers rate the same vendor differently.
- Time-consuming: reviewing all past orders for every bid evaluation.
- Gameable: vendors can cultivate relationships with specific officers to influence scoring.

**Automated scoring:**
- Consistent: same formula applied to all vendors.
- Real-time: updates every time a delivery is recorded.
- Objective: based on actual data (days late, invoice discrepancies, price vs market).
- Surfaced in bid evaluation: officers see the risk level before awarding a contract.

### Score API Endpoints

```
GET /api/scores/ranking
  → Returns all vendors sorted by overallScore DESC
  → Used in scoring dashboard to see who the best vendors are

GET /api/scores/vendor/{vendorId}/performance
  → Detailed breakdown: each KPI, historical trend
  → Used in RFQ bid evaluation to compare vendors

GET /api/scores/ranking?riskLevel=HIGH
  → Lists all HIGH risk vendors (for compliance review)
```

---

## Redis Caching in vendor-service

Vendor data is read frequently (every RFQ, every PO shows vendor names). Redis caching prevents hitting the database on every read:

```java
@Cacheable(value = "vendors", key = "#tenantId + ':' + #vendorId")
public VendorResponse getVendorById(Long tenantId, Long vendorId) {
    return vendorRepository.findById(vendorId)...;
}

@CacheEvict(value = "vendors", key = "#tenantId + ':' + #vendorId")
public VendorResponse updateVendor(Long vendorId, ...) { ... }
```

**Tenant-prefixed cache keys:** `tenant:{id}:vendors:{vendorId}` — ensures vendor data from one tenant never accidentally serves to another tenant (since cache keys are shared in the same Redis instance within the service).

The frontend also maintains a **local vendor name map** in memory:

```typescript
// lib/api.ts
const vendorNameCache = new Map<number, string>();

async function resolveCompanyName(vendorId: number): Promise<string> {
    if (vendorNameCache.has(vendorId)) return vendorNameCache.get(vendorId)!;
    const vendor = await vendorApi.getById(vendorId);
    vendorNameCache.set(vendorId, vendor.companyName);
    return vendor.companyName;
}
```

This avoids making 50 API calls to show a table of 50 purchase orders (each with a vendorId). Instead, each unique vendor is fetched once and re-used from the in-memory map for the session.
