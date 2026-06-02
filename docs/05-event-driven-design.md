# Event-Driven Design — Kafka, Async Processing, Notifications

> **Who should read this:** Developers touching any service that produces or consumes Kafka events, or anyone trying to understand why certain actions have delayed side effects.

---

## Why Kafka? Why Not Just HTTP Calls?

When a delivery is marked complete, three things need to happen:
1. The procurement service needs to update the PO status to "Delivered".
2. The scoring service needs to update the vendor's on-time delivery score.
3. The notification service needs to send an email if the delivery is late.

**Option A: Synchronous HTTP chain**
```
delivery-service → HTTP → procurement-service
delivery-service → HTTP → scoring-service
delivery-service → HTTP → notification-service
```

Problems:
- If scoring-service is down, the whole delivery update fails.
- If notification-service is slow, the user waits for the delivery update to complete.
- delivery-service now has hard dependencies on 3 other services — coupling increases.
- Each service must be up and reachable at the exact moment the event occurs.

**Option B: Asynchronous Kafka events**
```
delivery-service → Kafka "delivery.completed" → (stored durably)
                                               ↓
                             scoring-service ← consumes when ready
                             notification-service ← consumes when ready
                             (procurement is called synchronously since PO status
                              needs to be immediate — see the exception below)
```

Benefits:
- delivery-service only knows about Kafka, not about scoring/notification services.
- If scoring-service is temporarily down, the event sits in Kafka — scoring-service processes it when it restarts.
- Delivery update returns to the user immediately; email sending happens asynchronously.
- Each consumer can be scaled independently.

**Why is the procurement-service PO update still synchronous?**
Because the officer needs to immediately see the PO status as "Delivered" on their dashboard. A 30-second async delay would cause confusion ("I marked it delivered but the PO still says 'Approved'"). Immediate user-facing state changes warrant synchronous calls; background processing warrants Kafka.

---

## The Kafka Topics

| Topic | Produced by | Consumed by | What It Carries |
|---|---|---|---|
| `vendor.verified` | vendor-service | notification-service | vendorId, vendorName, email, tenantId |
| `rfq.published` | rfq-bidding-service | notification-service | rfqId, title, deadline, estimatedValue, categoryId |
| `bid.submitted` | rfq-bidding-service | notification-service, scoring-service | bidId, rfqId, vendorId, bidAmount, vendorName, rfqCreatorEmail |
| `po.approved` | procurement-service | notification-service | poId, vendorId, vendorEmail, vendorName, totalAmount, tenantId |
| `delivery.completed` | delivery-invoice-service | notification-service, scoring-service | deliveryId, poId, vendorId, expectedDate, actualDate, onTime, adminEmail |
| `invoice.discrepancy` | delivery-invoice-service | notification-service, scoring-service | invoiceId, poId, vendorId, discrepancyReason, amount |
| `score.updated` | scoring-service | (not currently consumed — available for future subscribers) | vendorId, overallScore, riskLevel |

---

## Kafka Configuration

### Producer Configuration (in every producing service)

```yaml
spring:
  kafka:
    producer:
      acks: all                          # Wait for all replicas to confirm
      enable-idempotence: true           # Exactly-once delivery guarantee
      retries: 3
      properties:
        max.in.flight.requests.per.connection: 5
```

**`acks: all`** means the broker won't acknowledge the message until it's been written to all in-sync replicas. If only one replica acknowledges (the default `acks: 1`), and that broker crashes before replication completes, the event is lost. With `acks: all`, no event is acknowledged until it's durable.

**`enable.idempotence: true`** means even if the producer retries (e.g., due to a network hiccup), the broker deduplicates and stores the message exactly once. Without idempotence, a retry would produce duplicate events ("delivery completed" twice → vendor score updated twice).

**Error logging on every send:**
```java
kafkaTemplate.send("delivery.completed", event)
    .whenComplete((result, ex) -> {
        if (ex != null) {
            log.error("Failed to publish delivery.completed for deliveryId={}", 
                      event.getDeliveryId(), ex);
        }
    });
```

Kafka sends are non-blocking. Without `.whenComplete()`, a send failure would be silently swallowed. This ensures every failure is logged so operators can detect and investigate message loss.

### Consumer Configuration (in every consuming service)

```yaml
spring:
  kafka:
    consumer:
      group-id: notification-service-group    # Unique per service
      auto-offset-reset: earliest             # If no offset: start from beginning
      properties:
        spring.json.trusted.packages: "com.procurement.*,java.util.*"
```

**`group-id`** uniquely identifies this service's consumer group. Kafka tracks which messages each group has consumed. If notification-service restarts, it picks up from where it left off — no messages skipped, no messages re-processed.

**`spring.json.trusted.packages`** is a security setting. Spring's Kafka deserialization would otherwise refuse to deserialize objects from untrusted packages (to prevent arbitrary class instantiation from malicious messages). This explicitly whitelists the procurement domain classes.

---

## Retry and Dead Letter Topics (DLT)

What if consuming a message fails? (E.g., notification-service can't connect to SMTP, or scoring-service has a DB error.)

```java
// notification-service/KafkaConsumer.java
@RetryableTopic(
    attempts = "3",
    backoff = @Backoff(delay = 1000, multiplier = 2)  // 1s, 2s, 4s
)
@KafkaListener(topics = "po.approved", groupId = "notification-service-group")
public void handlePOApproved(POApprovedEvent event) {
    notificationService.sendVendorPONotification(event);
}
```

**Retry sequence:**
1. First attempt fails → wait 1 second → retry
2. Second attempt fails → wait 2 seconds → retry
3. Third attempt fails → wait 4 seconds → retry
4. All retries exhausted → message moves to Dead Letter Topic: `po.approved-dlt`

**Dead Letter Topic (DLT):**
Failed messages accumulate in the DLT. An operator can:
- Inspect them (why did processing fail?).
- Fix the underlying issue (e.g., SMTP server down).
- Replay them from the DLT.

Without DLT, permanently failed messages would block the partition or be silently lost.

---

## Notification Service — The Event Aggregator

The `notification-service` is the only service that consumes from **all** 7 topics. It acts as the central hub for all user-facing communications.

### What It Does for Each Event

**`vendor.verified`:**
```
→ Creates in-app Notification record (userId = vendorId's user, category = "VENDOR_UPDATE")
→ Sends email to vendor: "Your account has been verified"
→ Creates notification for procurement officers: "New vendor verified: {companyName}"
```

**`rfq.published`:**
```
→ Creates notifications for all verified vendors in the RFQ's category
→ Subject: "New RFQ: {title} — Deadline: {deadline}"
→ Includes: estimatedValue, category, link to bid
```

**`bid.submitted`:**
```
→ If event has rfqCreatorEmail (officer opted in): sends email
→ Subject: "New bid submitted by {vendorName} for RFQ: {rfqTitle}"
→ Includes: bidAmount, deliveryDays
```

**`po.approved`:**
```
→ Sends email to vendorEmail (embedded in event by procurement-service)
→ Subject: "Purchase Order Approved — {poId}"
→ Body: "Your bid has been selected. PO amount: ${totalAmount}. 
         Expected delivery: {expectedDeliveryDate}. Please proceed with fulfillment."
```

**`delivery.completed`:**
```
→ If delayDays > 7:
    → Sends email to adminEmail (embedded in event)
    → Subject: "Late Delivery Alert: {deliveryId} was {delayDays} days late"
```

**`invoice.discrepancy`:**
```
→ Creates in-app notification for OFFICER/ADMIN users
→ Subject: "Invoice Discrepancy Detected for PO {poId}"
→ Body: discrepancyReason + link to invoice for review
```

### Notification Entity

```java
Notification {
    notificationId
    tenantId
    userId          // Who should see this notification
    type            // "EMAIL" | "IN_APP" | "BOTH"
    title
    message         // TEXT — HTML email body or in-app message
    status          // "CREATED" | "SENT" | "READ"
    category        // "VENDOR_UPDATE" | "RFQ" | "PROCUREMENT" | "DELIVERY" | "INVOICE"
    relatedEntityId // The entity this notification is about (for deep linking)
    createdAt, sentAt, readAt
}
```

**Index on `(userId, status)`:** The most common query is "get all unread notifications for this user". This composite index makes it O(log n) instead of a full table scan.

### Email Sending

```java
// notification-service/NotificationService.java
@Async  // runs in background thread — doesn't block Kafka consumer
void sendEmail(String to, String subject, String htmlBody) {
    MimeMessage message = mailSender.createMimeMessage();
    MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
    helper.setTo(to);
    helper.setSubject(subject);
    helper.setText(htmlBody, true);  // true = HTML email
    mailSender.send(message);
}
```

**`@Async`** means the email send happens on a separate thread pool. The Kafka consumer thread returns immediately after publishing to the thread pool — it doesn't wait for SMTP. This is important because:
- SMTP calls can take 1-3 seconds.
- Holding the Kafka consumer thread for that long would reduce throughput.
- If SMTP fails, it throws in the background thread (logged), but doesn't affect the Kafka consumer offset (message is already committed).

**SMTP configuration:**
```yaml
spring:
  mail:
    host: smtp.gmail.com
    port: 587
    username: ${SMTP_USERNAME}   # Must be set via env var — no hardcoded credentials
    password: ${SMTP_PASSWORD}   # Gmail App Password (not account password)
    properties:
      mail.smtp.auth: true
      mail.smtp.starttls.enable: true
```

Why `SMTP_USERNAME` and `SMTP_PASSWORD` as env vars? Because credentials committed to source code get leaked. Environment variables are injected at runtime and can be rotated without code changes.

---

## Event Classes (Shared Data Contracts)

Each event is a simple Java class serialized to JSON:

```java
// delivery-invoice-service
public class DeliveryCompletedEvent {
    private Long deliveryId;
    private Long poId;
    private Long vendorId;
    private Long tenantId;
    private LocalDateTime expectedDate;
    private LocalDateTime actualDate;
    private Integer quantityDelivered;
    private boolean onTime;          // pre-calculated: actualDate <= expectedDate
    private String adminEmail;       // for late delivery alerts
}

// rfq-bidding-service
public class BidSubmittedEvent {
    private Long bidId;
    private Long rfqId;
    private Long vendorId;
    private Long tenantId;
    private BigDecimal bidAmount;
    private String vendorName;       // fetched from vendor-service before publishing
    private String rfqTitle;         // from the RFQ entity
    private String rfqCreatorEmail;  // officer email — for bid notification opt-in
}
```

**Why embed `vendorName` and `rfqCreatorEmail` in the event?**

The notification-service consumes this event but does not have access to vendor-service or rfq-bidding-service's databases. It could call those services via HTTP to fetch the name, but:
- That adds latency to every event.
- If vendor-service is down when notification-service processes the event, the notification would fail.
- Embedding the data at publish time (when vendor-service is clearly up, since it just produced the event) makes the consumer self-sufficient.

This pattern is called **event enrichment** — publish enough context that consumers don't need to make additional calls.

---

## The analytics-service Anti-Pattern (and why it's intentional)

`analytics-service` does NOT use Kafka. It's a pure synchronous aggregator:
- When a dashboard is requested, it calls 3 services via HTTP.
- Results are cached in Redis for ~5 minutes.
- On cache miss, it makes the HTTP calls again.

**Why not consume Kafka events and maintain its own aggregate?**
- Would require maintaining state: a separate PostgreSQL database and event-sourcing logic.
- Analytics data is non-critical — slight staleness is acceptable.
- Simple HTTP + cache is far less complex to implement and maintain.
- If any upstream service is unavailable, the analytics page shows a partial result rather than getting stuck on a stale event.

For a production system with strict latency requirements or high query volume, event-sourced materialized views would be the right approach. For the current project stage, HTTP + Redis cache is the right trade-off.
