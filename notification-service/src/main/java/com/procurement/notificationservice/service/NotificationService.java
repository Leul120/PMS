package com.procurement.notificationservice.service;

import com.procurement.notificationservice.dto.NotificationRequest;
import com.procurement.notificationservice.dto.NotificationResponse;
import com.procurement.notificationservice.entity.Notification;
import com.procurement.notificationservice.repository.NotificationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import com.procurement.notificationservice.util.NotificationRouteBuilder;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class NotificationService {

    private final JavaMailSender mailSender;
    private final NotificationRepository notificationRepository;

    // ── Kafka listener (single container — avoids retry-topic / thread exhaustion) ──

    @KafkaListener(
            topics = {
                    "vendor.verified", "rfq.published", "bid.submitted", "po.approved",
                    "delivery.completed", "invoice.discrepancy", "inventory.low-stock",
                    "dispute.raised", "dispute.resolved", "score.updated",
                    "bid.deadline.approaching", "approval.pending"
            },
            groupId = "notification-service-group",
            containerFactory = "kafkaListenerContainerFactory")
    public void onDomainEvent(ConsumerRecord<String, Map<String, Object>> record) {
        Map<String, Object> event = record.value();
        if (event == null) {
            log.warn("Skipping null payload on topic {}", record.topic());
            return;
        }
        try {
            switch (record.topic()) {
                case "vendor.verified" -> handleVendorVerified(event);
                case "rfq.published" -> handleRFQPublished(event);
                case "bid.submitted" -> handleBidSubmitted(event);
                case "po.approved" -> handlePOApproved(event);
                case "delivery.completed" -> handleDeliveryCompleted(event);
                case "invoice.discrepancy" -> handleInvoiceDiscrepancy(event);
                case "inventory.low-stock" -> handleLowStock(event);
                case "dispute.raised" -> handleDisputeRaised(event);
                case "dispute.resolved" -> handleDisputeResolved(event);
                case "score.updated" -> handleScoreUpdated(event);
                case "bid.deadline.approaching" -> handleBidDeadlineApproaching(event);
                case "approval.pending" -> handleApprovalPending(event);
                default -> log.warn("Unhandled notification topic: {}", record.topic());
            }
        } catch (Exception e) {
            log.error("Failed to process {} (partition={}, offset={}): {}",
                    record.topic(), record.partition(), record.offset(), e.getMessage(), e);
        }
    }

    // ── Event handlers ────────────────────────────────────────────────────────

    public void handleVendorVerified(Map<String, Object> event) {
        String email = (String) event.get("email");
        String companyName = (String) event.getOrDefault("companyName", "Vendor");
        Long vendorId = toLong(event.get("vendorId"));
        log.info("Vendor verified: vendorId={}, email={}", vendorId, email);

        Long tenantId = toLong(event.get("tenantId"));
        // Persist in-app notification
        saveNotification(tenantId, null, "SYSTEM", "Vendor Verified",
            companyName + " has been verified and is now active on the platform.",
            "VENDOR_MANAGEMENT", vendorId != null ? vendorId.toString() : null, null);

        // Send email to vendor
        if (email != null) {
            sendEmailAsync(email, "Your Vendor Account Has Been Verified — ProcurePro",
                "Dear " + companyName + ",\n\n" +
                "Congratulations! Your vendor account has been verified and is now active.\n\n" +
                "You can now:\n" +
                "  • Browse and respond to open RFQs\n" +
                "  • Submit competitive bids\n" +
                "  • Track your purchase orders and deliveries\n\n" +
                "Log in at https://procurepro.app to get started.\n\n" +
                "Best regards,\nProcurePro Team");
        }
    }

    public void handleRFQPublished(Map<String, Object> event) {
        Long rfqId = toLong(event.get("rfqId"));
        String title = (String) event.getOrDefault("title", "New RFQ");
        String deadline = event.get("deadline") != null ? event.get("deadline").toString() : "TBD";
        Object estimatedValue = event.get("estimatedValue");
        Long tenantId = toLong(event.get("tenantId"));
        log.info("RFQ published: rfqId={}, title={}", rfqId, title);

        // Persist broadcast in-app notification (userId=null → all tenant users see it)
        saveNotification(tenantId, null, "RFQ", "New RFQ Published: " + title,
            "RFQ #" + rfqId + " has been published. Deadline: " + deadline +
            (estimatedValue != null ? ". Estimated value: $" + estimatedValue : ""),
            "RFQ", rfqId != null ? rfqId.toString() : null, null);

        // Send email to matching active vendors
        Object vendorEmailsRaw = event.get("vendorEmails");
        if (vendorEmailsRaw instanceof List<?> vendorEmails && !vendorEmails.isEmpty()) {
            String emailBody = "Dear Vendor,\n\n" +
                "A new Request for Quotation has been published that matches your category:\n\n" +
                "  RFQ: " + title + "\n" +
                "  Deadline: " + deadline + "\n" +
                (estimatedValue != null ? "  Estimated Value: $" + estimatedValue + "\n" : "") +
                "\nLog in to ProcurePro to review the RFQ and submit your bid.\n\n" +
                "Best regards,\nProcurePro Procurement Team";
            for (Object emailObj : vendorEmails) {
                if (emailObj instanceof String email && !email.isBlank()) {
                    sendEmailAsync(email, "New RFQ Available: " + title + " — ProcurePro", emailBody);
                }
            }
            log.info("RFQ published email dispatched to {} vendor(s)", vendorEmails.size());
        }
    }

    public void handleBidSubmitted(Map<String, Object> event) {
        Long tenantId = toLong(event.get("tenantId"));
        Long bidId = toLong(event.get("bidId"));
        Long rfqId = toLong(event.get("rfqId"));
        Long vendorId = toLong(event.get("vendorId"));
        Object bidAmount = event.get("bidAmount");
        String vendorName = (String) event.getOrDefault("vendorName", "Vendor #" + vendorId);
        String rfqTitle = (String) event.getOrDefault("rfqTitle", "RFQ #" + rfqId);
        String rfqCreatorEmail = (String) event.get("rfqCreatorEmail");
        log.info("Bid submitted: bidId={}, rfqId={}, vendorId={}", bidId, rfqId, vendorId);

        String notifMessage = vendorName + " submitted a bid of $" + bidAmount +
            " for " + rfqTitle + " (RFQ #" + rfqId + "). Bid ID: " + bidId;

        saveNotification(tenantId, null, "BID", "New Bid Received on " + rfqTitle, notifMessage,
            "BID", rfqId != null ? rfqId.toString() : null, null);

        if (rfqCreatorEmail != null && !rfqCreatorEmail.isBlank()) {
            sendEmailAsync(rfqCreatorEmail, "New Bid Received — " + rfqTitle,
                "Hello,\n\n" + vendorName + " has submitted a bid of $" + bidAmount +
                " for your RFQ: " + rfqTitle + ".\n\n" +
                "Log in to ProcurePro to review and evaluate the bid.\n\n" +
                "Best regards,\nProcurePro Team");
        }
    }

    public void handlePOApproved(Map<String, Object> event) {
        Long tenantId = toLong(event.get("tenantId"));
        Long poId = toLong(event.get("poId"));
        Long vendorId = toLong(event.get("vendorId"));
        Object totalAmount = event.get("totalAmount");
        Long approvedBy = toLong(event.get("approvedBy"));
        String vendorEmail = (String) event.get("vendorEmail");
        String vendorName = (String) event.getOrDefault("vendorName", "Vendor #" + vendorId);
        log.info("PO approved: poId={}, vendorId={}, amount={}", poId, vendorId, totalAmount);

        String poNumber = "PO-" + String.format("%06d", poId != null ? poId : 0);

        saveNotification(tenantId, vendorId, "PURCHASE_ORDER", "Purchase Order " + poNumber + " Approved",
            "Your purchase order " + poNumber + " for $" + totalAmount +
            " has been approved. Please prepare for delivery as per the agreed schedule.",
            "PURCHASE_ORDER", poId != null ? poId.toString() : null, poId);

        saveNotification(tenantId, approvedBy, "PURCHASE_ORDER", poNumber + " Approved Successfully",
            "Purchase order " + poNumber + " (" + vendorName + ", $" + totalAmount +
            ") has been approved and the vendor has been notified.",
            "PURCHASE_ORDER", poId != null ? poId.toString() : null, poId);

        // Email the vendor
        if (vendorEmail != null && !vendorEmail.isBlank()) {
            sendEmailAsync(vendorEmail, "Purchase Order " + poNumber + " Approved — ProcurePro",
                "Dear " + vendorName + ",\n\n" +
                "We are pleased to inform you that Purchase Order " + poNumber +
                " for $" + totalAmount + " has been approved.\n\n" +
                "Please prepare for delivery as per the agreed schedule and update the delivery status in the portal.\n\n" +
                "Log in to ProcurePro to view the full details.\n\n" +
                "Best regards,\nProcurePro Procurement Team");
        }
    }

    public void handleDeliveryCompleted(Map<String, Object> event) {
        Long tenantId = toLong(event.get("tenantId"));
        Long deliveryId = toLong(event.get("deliveryId"));
        Long poId = toLong(event.get("poId"));
        Long vendorId = toLong(event.get("vendorId"));
        Integer delayDays = event.get("delayDays") instanceof Number n ? n.intValue() : 0;
        Integer quantityDelivered = event.get("quantityDelivered") instanceof Number n ? n.intValue() : null;
        String qualityRemarks = (String) event.getOrDefault("qualityRemarks", "");
        log.info("Delivery completed: deliveryId={}, poId={}, delayDays={}", deliveryId, poId, delayDays);

        String timeliness = delayDays == 0 ? "on time" : delayDays + " day(s) late";
        String poNumber = "PO-" + String.format("%06d", poId != null ? poId : 0);

        saveNotification(tenantId, null, "DELIVERY",
            "Delivery Completed for " + poNumber,
            "Delivery #" + deliveryId + " for " + poNumber + " completed " + timeliness +
            (quantityDelivered != null ? ". Quantity: " + quantityDelivered : "") +
            (qualityRemarks != null && !qualityRemarks.isBlank() ? ". Remarks: " + qualityRemarks : ""),
            "DELIVERY", deliveryId != null ? deliveryId.toString() : null, poId);

        // Alert if delivery was significantly late
        if (delayDays > 7) {
            String alertMessage = "Vendor #" + vendorId + " delivered " + delayDays +
                " days late for " + poNumber + ". This will impact their performance score.";
            saveNotification(tenantId, null, "DELIVERY", "Late Delivery Alert — " + poNumber,
                alertMessage, "DELIVERY", poId != null ? poId.toString() : null, poId);

            String adminEmail = (String) event.get("adminEmail");
            if (adminEmail != null && !adminEmail.isBlank()) {
                sendEmailAsync(adminEmail, "Late Delivery Alert — " + poNumber,
                    "Hello,\n\n" + alertMessage + "\n\nPlease review and take appropriate action.\n\n" +
                    "Best regards,\nProcurePro System");
            }
        }
    }

    public void handleInvoiceDiscrepancy(Map<String, Object> event) {
        Long tenantId = toLong(event.get("tenantId"));
        Long invoiceId = toLong(event.get("invoiceId"));
        Long poId = toLong(event.get("poId"));
        Object invoiceAmount = event.get("invoiceAmount");
        Object expectedAmount = event.get("expectedAmount");
        String reason = (String) event.getOrDefault("discrepancyReason", "Amount mismatch");
        log.warn("Invoice discrepancy: invoiceId={}, poId={}, reason={}", invoiceId, poId, reason);

        String poNumber = "PO-" + String.format("%06d", poId != null ? poId : 0);

        saveNotification(tenantId, null, "INVOICE",
            "Invoice Discrepancy Detected — " + poNumber,
            "Invoice #" + invoiceId + " for " + poNumber + " has a discrepancy.\n" +
            "Invoice amount: $" + invoiceAmount + " | Expected: $" + expectedAmount + "\n" +
            "Reason: " + reason + "\nPlease review and resolve.",
            "INVOICE", invoiceId != null ? invoiceId.toString() : null, poId);
    }

    public void handleLowStock(Map<String, Object> event) {
        Long tenantId = toLong(event.get("tenantId"));
        String itemCode = (String) event.getOrDefault("itemCode", "Unknown");
        String name = (String) event.getOrDefault("name", itemCode);
        Object qty = event.get("quantity");
        Object min = event.get("minStock");
        String status = (String) event.getOrDefault("status", "low");
        log.warn("Low stock alert: {} ({}) qty={} min={}", name, itemCode, qty, min);

        boolean critical = "critical".equals(status);
        saveNotification(tenantId, null, "INVENTORY",
            (critical ? "Critical Stock: " : "Low Stock: ") + name,
            (critical ? "CRITICAL: " : "") + name + " (" + itemCode + ") is " +
            (critical ? "out of stock" : "running low") +
            ". Current quantity: " + qty + " (minimum: " + min + "). Please reorder.",
            "INVENTORY", String.valueOf(event.getOrDefault("itemId", "")), null);
    }

    public void handleDisputeRaised(Map<String, Object> event) {
        Long tenantId = toLong(event.get("tenantId"));
        Long disputeId = toLong(event.get("disputeId"));
        Long poId = toLong(event.get("poId"));
        String disputeType = (String) event.getOrDefault("disputeType", "DISPUTE");
        String description = (String) event.getOrDefault("description", "");
        String raisedByRole = (String) event.getOrDefault("raisedByRole", "");
        log.info("Dispute raised: disputeId={}, poId={}, type={}", disputeId, poId, disputeType);

        String poNumber = "PO-" + String.format("%06d", poId != null ? poId : 0);

        saveNotification(tenantId, null, "DISPUTE",
            "Dispute Raised — " + poNumber,
            "A " + disputeType.replace("_", " ").toLowerCase() + " dispute (#" + disputeId +
            ") has been raised for " + poNumber + " by " + raisedByRole + ".\n" +
            "Details: " + description + "\nPlease review and resolve.",
            "DISPUTE", disputeId != null ? disputeId.toString() : null, poId);
    }

    public void handleDisputeResolved(Map<String, Object> event) {
        Long tenantId = toLong(event.get("tenantId"));
        Long disputeId = toLong(event.get("disputeId"));
        Long poId = toLong(event.get("poId"));
        String resolution = (String) event.getOrDefault("resolution", "");
        String disputeType = (String) event.getOrDefault("disputeType", "DISPUTE");
        log.info("Dispute resolved: disputeId={}, poId={}", disputeId, poId);

        String poNumber = "PO-" + String.format("%06d", poId != null ? poId : 0);

        saveNotification(tenantId, null, "DISPUTE",
            "Dispute Resolved — " + poNumber,
            "Dispute #" + disputeId + " (" + disputeType.replace("_", " ").toLowerCase() +
            ") for " + poNumber + " has been resolved.\n" +
            "Resolution: " + resolution,
            "DISPUTE", disputeId != null ? disputeId.toString() : null, poId);
    }

    public void handleScoreUpdated(Map<String, Object> event) {
        Long tenantId = toLong(event.get("tenantId"));
        Long vendorId = toLong(event.get("vendorId"));
        String riskLevel = (String) event.getOrDefault("riskLevel", "Low");
        Object score = event.get("overallScore");
        log.info("Score updated: vendorId={}, riskLevel={}, score={}", vendorId, riskLevel, score);

        if ("High".equals(riskLevel)) {
            saveNotification(tenantId, null, "COMPLIANCE",
                "High Risk Vendor Alert — Vendor #" + vendorId,
                "Vendor #" + vendorId + " has been flagged as HIGH RISK (score: " + score + ").\n" +
                "Immediate review recommended. Consider suspending new POs until resolved.",
                "VENDOR_MANAGEMENT", vendorId != null ? vendorId.toString() : null, null);
        } else if ("Medium".equals(riskLevel)) {
            saveNotification(tenantId, null, "COMPLIANCE",
                "Medium Risk Vendor — Vendor #" + vendorId,
                "Vendor #" + vendorId + " performance score dropped to " + score +
                " (Medium risk). Monitor closely.",
                "VENDOR_MANAGEMENT", vendorId != null ? vendorId.toString() : null, null);
        }
    }

    public void handleBidDeadlineApproaching(Map<String, Object> event) {
        Long tenantId = toLong(event.get("tenantId"));
        Long rfqId = toLong(event.get("rfqId"));
        String deadline = event.get("deadline") != null ? event.get("deadline").toString() : "soon";
        String title = (String) event.getOrDefault("title", "RFQ #" + rfqId);
        log.info("Bid deadline approaching: rfqId={}, deadline={}", rfqId, deadline);

        saveNotification(tenantId, null, "RFQ",
            "Bid Deadline Approaching — " + title,
            "The bidding deadline for RFQ #" + rfqId + " (" + title + ") is approaching: " + deadline +
            ".\nSubmit your bid now to be considered.",
            "RFQ", rfqId != null ? rfqId.toString() : null, null);
    }

    public void handleApprovalPending(Map<String, Object> event) {
        Long tenantId = toLong(event.get("tenantId"));
        Long poId = toLong(event.get("poId"));
        Object amount = event.get("totalAmount");
        Long requestedBy = toLong(event.get("requestedBy"));
        log.info("Approval pending: poId={}, amount={}", poId, amount);

        String poNumber = "PO-" + String.format("%06d", poId != null ? poId : 0);

        saveNotification(tenantId, null, "APPROVAL",
            "Purchase Order Awaiting Your Approval — " + poNumber,
            poNumber + " for $" + amount + " requires your approval.\n" +
            "Requested by user #" + requestedBy + ".\n" +
            "Log in to review and approve or reject.",
            "PURCHASE_ORDER", poId != null ? poId.toString() : null, poId);
    }

    // ── CRUD ──────────────────────────────────────────────────────────────────

    @Transactional
    public NotificationResponse createNotification(NotificationRequest request) {
        if (request == null) throw new IllegalArgumentException("Notification request cannot be null");
        Notification notification = new Notification();
        notification.setTenantId(request.getTenantId() != null ? request.getTenantId() : 0L);
        notification.setUserId(request.getUserId());
        notification.setType(request.getType());
        notification.setTitle(request.getTitle());
        notification.setMessage(request.getMessage());
        notification.setCategory(request.getCategory());
        notification.setRelatedEntityId(request.getRelatedEntityId());
        notification.setActionUrl(request.getActionUrl() != null && !request.getActionUrl().isBlank()
            ? request.getActionUrl()
            : NotificationRouteBuilder.build(request.getCategory(), request.getRelatedEntityId(), request.getTitle()));
        notification.setStatus("PENDING");
        notification.setCreatedAt(LocalDateTime.now());
        Notification saved = notificationRepository.save(notification);
        log.info("Notification created for user {}: {}", request.getUserId(), request.getTitle());
        return mapToResponse(saved);
    }

    @Transactional(readOnly = true)
    public List<NotificationResponse> getUserNotifications(Long userId) {
        try {
            return notificationRepository.findByUserIdOrBroadcast(userId).stream()
                .map(this::mapToResponse).collect(Collectors.toList());
        } catch (Exception e) {
            log.warn("Could not fetch notifications for user {}: {}", userId, e.getMessage());
            return List.of();
        }
    }

    @Transactional(readOnly = true)
    public List<NotificationResponse> getUnreadNotifications(Long userId) {
        try {
            return notificationRepository.findByUserIdOrBroadcastAndStatus(userId, "PENDING").stream()
                .map(this::mapToResponse).collect(Collectors.toList());
        } catch (Exception e) {
            log.warn("Could not fetch unread notifications for user {}: {}", userId, e.getMessage());
            return List.of();
        }
    }

    @Transactional
    public NotificationResponse markAsRead(Long notificationId) {
        Notification n = notificationRepository.findById(notificationId)
            .orElseThrow(() -> new RuntimeException("Notification not found"));
        n.setStatus("READ");
        n.setReadAt(LocalDateTime.now());
        return mapToResponse(notificationRepository.save(n));
    }

    @Transactional
    public NotificationResponse sendNotification(Long notificationId) {
        Notification n = notificationRepository.findById(notificationId)
            .orElseThrow(() -> new RuntimeException("Notification not found"));
        n.setStatus("SENT");
        n.setSentAt(LocalDateTime.now());
        return mapToResponse(notificationRepository.save(n));
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    /** Persists an in-app notification record. userId=null means broadcast/system. tenantId=0 means platform-level. */
    @Transactional
    public void saveNotification(Long tenantId, Long userId, String type, String title,
                                  String message, String category, String relatedEntityId, Long poId) {
        try {
            Notification n = new Notification();
            n.setTenantId(tenantId != null ? tenantId : 0L);
            n.setUserId(userId);
            n.setType(type);
            n.setTitle(title);
            n.setMessage(message);
            n.setCategory(category);
            n.setRelatedEntityId(relatedEntityId);
            n.setActionUrl(NotificationRouteBuilder.build(category, relatedEntityId, title, poId));
            n.setStatus("PENDING");
            n.setCreatedAt(LocalDateTime.now());
            notificationRepository.save(n);
        } catch (Exception e) {
            log.error("Failed to persist notification '{}': {}", title, e.getMessage());
        }
    }

    /** Sends email on a virtual-thread executor — never blocks Kafka consumer threads. */
    @Async("emailExecutor")
    public void sendEmailAsync(String to, String subject, String body) {
        try {
            // Skip silently if SMTP is not configured (username is blank)
            if (mailSender == null) {
                log.debug("Mail sender not configured, skipping email to: {}", to);
                return;
            }
            SimpleMailMessage message = new SimpleMailMessage();
            message.setTo(to);
            message.setSubject(subject);
            message.setText(body);
            mailSender.send(message);
            log.info("Email sent to: {}", to);
        } catch (Exception e) {
            // Email failure must never crash the service or fail a Kafka listener
            log.warn("Email send failed (non-fatal) to {}: {}", to, e.getMessage());
        }
    }

    private Long toLong(Object value) {
        if (value == null) return null;
        if (value instanceof Number n) return n.longValue();
        try { return Long.parseLong(value.toString()); } catch (NumberFormatException e) { return null; }
    }

    private NotificationResponse mapToResponse(Notification n) {
        return NotificationResponse.builder()
            .notificationId(n.getNotificationId())
            .userId(n.getUserId())
            .type(n.getType())
            .title(n.getTitle())
            .message(n.getMessage())
            .status(n.getStatus())
            .category(n.getCategory())
            .relatedEntityId(n.getRelatedEntityId())
            .actionUrl(n.getActionUrl() != null && !n.getActionUrl().isBlank()
                ? n.getActionUrl()
                : NotificationRouteBuilder.build(n.getCategory(), n.getRelatedEntityId(), n.getTitle()))
            .createdAt(n.getCreatedAt())
            .sentAt(n.getSentAt())
            .readAt(n.getReadAt())
            .build();
    }
}
