package com.procurement.notificationservice.service;

import com.procurement.notificationservice.dto.NotificationRequest;
import com.procurement.notificationservice.dto.NotificationResponse;
import com.procurement.notificationservice.entity.Notification;
import com.procurement.notificationservice.repository.NotificationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.annotation.DltHandler;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.kafka.annotation.RetryableTopic;
import org.springframework.kafka.retrytopic.TopicSuffixingStrategy;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.retry.annotation.Backoff;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class NotificationService {

    private final JavaMailSender mailSender;
    private final NotificationRepository notificationRepository;

    // ── Kafka listeners ───────────────────────────────────────────────────────

    @RetryableTopic(attempts = "3", backoff = @Backoff(delay = 1000, multiplier = 2.0),
        topicSuffixingStrategy = TopicSuffixingStrategy.SUFFIX_WITH_INDEX_VALUE)
    @KafkaListener(topics = "vendor.verified", groupId = "notification-service-group")
    public void handleVendorVerified(Map<String, Object> event) {
        String email = (String) event.get("email");
        String companyName = (String) event.getOrDefault("companyName", "Vendor");
        Long vendorId = toLong(event.get("vendorId"));
        log.info("Vendor verified: vendorId={}, email={}", vendorId, email);

        // Persist in-app notification
        saveNotification(null, "SYSTEM", "Vendor Verified",
            companyName + " has been verified and is now active on the platform.",
            "VENDOR_MANAGEMENT", vendorId != null ? vendorId.toString() : null);

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

    @RetryableTopic(attempts = "3", backoff = @Backoff(delay = 1000, multiplier = 2.0),
        topicSuffixingStrategy = TopicSuffixingStrategy.SUFFIX_WITH_INDEX_VALUE)
    @KafkaListener(topics = "rfq.published", groupId = "notification-service-group")
    public void handleRFQPublished(Map<String, Object> event) {
        Long rfqId = toLong(event.get("rfqId"));
        String title = (String) event.getOrDefault("title", "New RFQ");
        String deadline = event.get("deadline") != null ? event.get("deadline").toString() : "TBD";
        Object estimatedValue = event.get("estimatedValue");
        log.info("RFQ published: rfqId={}, title={}", rfqId, title);

        // Persist in-app notification for procurement officers
        saveNotification(null, "RFQ", "New RFQ Published: " + title,
            "RFQ #" + rfqId + " has been published. Deadline: " + deadline +
            (estimatedValue != null ? ". Estimated value: $" + estimatedValue : ""),
            "RFQ", rfqId != null ? rfqId.toString() : null);
    }

    @RetryableTopic(attempts = "3", backoff = @Backoff(delay = 1000, multiplier = 2.0),
        topicSuffixingStrategy = TopicSuffixingStrategy.SUFFIX_WITH_INDEX_VALUE)
    @KafkaListener(topics = "bid.submitted", groupId = "notification-service-group")
    public void handleBidSubmitted(Map<String, Object> event) {
        Long bidId = toLong(event.get("bidId"));
        Long rfqId = toLong(event.get("rfqId"));
        Long vendorId = toLong(event.get("vendorId"));
        Object bidAmount = event.get("bidAmount");
        log.info("Bid submitted: bidId={}, rfqId={}, vendorId={}", bidId, rfqId, vendorId);

        // Notify procurement officers that a new bid arrived
        saveNotification(null, "BID", "New Bid Received on RFQ #" + rfqId,
            "Vendor #" + vendorId + " submitted a bid of $" + bidAmount +
            " for RFQ #" + rfqId + ". Bid ID: " + bidId,
            "BID", rfqId != null ? rfqId.toString() : null);
    }

    @RetryableTopic(attempts = "3", backoff = @Backoff(delay = 1000, multiplier = 2.0),
        topicSuffixingStrategy = TopicSuffixingStrategy.SUFFIX_WITH_INDEX_VALUE)
    @KafkaListener(topics = "po.approved", groupId = "notification-service-group")
    public void handlePOApproved(Map<String, Object> event) {
        Long poId = toLong(event.get("poId"));
        Long vendorId = toLong(event.get("vendorId"));
        Object totalAmount = event.get("totalAmount");
        Long approvedBy = toLong(event.get("approvedBy"));
        log.info("PO approved: poId={}, vendorId={}, amount={}", poId, vendorId, totalAmount);

        // Persist in-app notification for vendor and procurement team
        String poNumber = "PO-" + String.format("%06d", poId != null ? poId : 0);
        saveNotification(vendorId, "PURCHASE_ORDER", "Purchase Order " + poNumber + " Approved",
            "Your purchase order " + poNumber + " for $" + totalAmount +
            " has been approved. Please prepare for delivery as per the agreed schedule.",
            "PURCHASE_ORDER", poId != null ? poId.toString() : null);

        // Also notify the approver's team
        saveNotification(approvedBy, "PURCHASE_ORDER", poNumber + " Approved Successfully",
            "Purchase order " + poNumber + " (Vendor #" + vendorId + ", $" + totalAmount +
            ") has been approved and the vendor has been notified.",
            "PURCHASE_ORDER", poId != null ? poId.toString() : null);
    }

    @RetryableTopic(attempts = "3", backoff = @Backoff(delay = 1000, multiplier = 2.0),
        topicSuffixingStrategy = TopicSuffixingStrategy.SUFFIX_WITH_INDEX_VALUE)
    @KafkaListener(topics = "delivery.completed", groupId = "notification-service-group")
    public void handleDeliveryCompleted(Map<String, Object> event) {
        Long deliveryId = toLong(event.get("deliveryId"));
        Long poId = toLong(event.get("poId"));
        Long vendorId = toLong(event.get("vendorId"));
        Integer delayDays = event.get("delayDays") instanceof Number n ? n.intValue() : 0;
        Integer quantityDelivered = event.get("quantityDelivered") instanceof Number n ? n.intValue() : null;
        String qualityRemarks = (String) event.getOrDefault("qualityRemarks", "");
        log.info("Delivery completed: deliveryId={}, poId={}, delayDays={}", deliveryId, poId, delayDays);

        String timeliness = delayDays == 0 ? "on time" : delayDays + " day(s) late";
        String poNumber = "PO-" + String.format("%06d", poId != null ? poId : 0);

        saveNotification(null, "DELIVERY",
            "Delivery Completed for " + poNumber,
            "Delivery #" + deliveryId + " for " + poNumber + " completed " + timeliness +
            (quantityDelivered != null ? ". Quantity: " + quantityDelivered : "") +
            (qualityRemarks != null && !qualityRemarks.isBlank() ? ". Remarks: " + qualityRemarks : ""),
            "DELIVERY", deliveryId != null ? deliveryId.toString() : null);

        // Alert if delivery was significantly late
        if (delayDays > 7) {
            saveNotification(null, "DELIVERY",
                "Late Delivery Alert — " + poNumber,
                "Vendor #" + vendorId + " delivered " + delayDays + " days late for " + poNumber +
                ". This will impact their performance score.",
                "DELIVERY", poId != null ? poId.toString() : null);
        }
    }

    @RetryableTopic(attempts = "3", backoff = @Backoff(delay = 1000, multiplier = 2.0),
        topicSuffixingStrategy = TopicSuffixingStrategy.SUFFIX_WITH_INDEX_VALUE)
    @KafkaListener(topics = "invoice.discrepancy", groupId = "notification-service-group")
    public void handleInvoiceDiscrepancy(Map<String, Object> event) {
        Long invoiceId = toLong(event.get("invoiceId"));
        Long poId = toLong(event.get("poId"));
        Object invoiceAmount = event.get("invoiceAmount");
        Object expectedAmount = event.get("expectedAmount");
        String reason = (String) event.getOrDefault("discrepancyReason", "Amount mismatch");
        log.warn("Invoice discrepancy: invoiceId={}, poId={}, reason={}", invoiceId, poId, reason);

        String poNumber = "PO-" + String.format("%06d", poId != null ? poId : 0);

        // Notify procurement team
        saveNotification(null, "INVOICE",
            "Invoice Discrepancy Detected — " + poNumber,
            "Invoice #" + invoiceId + " for " + poNumber + " has a discrepancy.\n" +
            "Invoice amount: $" + invoiceAmount + " | Expected: $" + expectedAmount + "\n" +
            "Reason: " + reason + "\nPlease review and resolve.",
            "INVOICE", invoiceId != null ? invoiceId.toString() : null);
    }

    @RetryableTopic(attempts = "3", backoff = @Backoff(delay = 1000, multiplier = 2.0),
        topicSuffixingStrategy = TopicSuffixingStrategy.SUFFIX_WITH_INDEX_VALUE)
    @KafkaListener(topics = "score.updated", groupId = "notification-service-group")
    public void handleScoreUpdated(Map<String, Object> event) {
        Long vendorId = toLong(event.get("vendorId"));
        String riskLevel = (String) event.getOrDefault("riskLevel", "Low");
        Object score = event.get("overallScore");
        log.info("Score updated: vendorId={}, riskLevel={}, score={}", vendorId, riskLevel, score);

        if ("High".equals(riskLevel)) {
            saveNotification(null, "COMPLIANCE",
                "High Risk Vendor Alert — Vendor #" + vendorId,
                "Vendor #" + vendorId + " has been flagged as HIGH RISK (score: " + score + ").\n" +
                "Immediate review recommended. Consider suspending new POs until resolved.",
                "VENDOR_MANAGEMENT", vendorId != null ? vendorId.toString() : null);
        } else if ("Medium".equals(riskLevel)) {
            saveNotification(null, "COMPLIANCE",
                "Medium Risk Vendor — Vendor #" + vendorId,
                "Vendor #" + vendorId + " performance score dropped to " + score +
                " (Medium risk). Monitor closely.",
                "VENDOR_MANAGEMENT", vendorId != null ? vendorId.toString() : null);
        }
    }

    @RetryableTopic(attempts = "3", backoff = @Backoff(delay = 1000, multiplier = 2.0),
        topicSuffixingStrategy = TopicSuffixingStrategy.SUFFIX_WITH_INDEX_VALUE)
    @KafkaListener(topics = "bid.deadline.approaching", groupId = "notification-service-group")
    public void handleBidDeadlineApproaching(Map<String, Object> event) {
        Long rfqId = toLong(event.get("rfqId"));
        String deadline = event.get("deadline") != null ? event.get("deadline").toString() : "soon";
        String title = (String) event.getOrDefault("title", "RFQ #" + rfqId);
        log.info("Bid deadline approaching: rfqId={}, deadline={}", rfqId, deadline);

        saveNotification(null, "RFQ",
            "Bid Deadline Approaching — " + title,
            "The bidding deadline for RFQ #" + rfqId + " (" + title + ") is approaching: " + deadline +
            ".\nSubmit your bid now to be considered.",
            "RFQ", rfqId != null ? rfqId.toString() : null);
    }

    @RetryableTopic(attempts = "3", backoff = @Backoff(delay = 1000, multiplier = 2.0),
        topicSuffixingStrategy = TopicSuffixingStrategy.SUFFIX_WITH_INDEX_VALUE)
    @KafkaListener(topics = "approval.pending", groupId = "notification-service-group")
    public void handleApprovalPending(Map<String, Object> event) {
        Long poId = toLong(event.get("poId"));
        Object amount = event.get("totalAmount");
        Long requestedBy = toLong(event.get("requestedBy"));
        log.info("Approval pending: poId={}, amount={}", poId, amount);

        String poNumber = "PO-" + String.format("%06d", poId != null ? poId : 0);

        saveNotification(null, "APPROVAL",
            "Purchase Order Awaiting Your Approval — " + poNumber,
            poNumber + " for $" + amount + " requires your approval.\n" +
            "Requested by user #" + requestedBy + ".\n" +
            "Log in to review and approve or reject.",
            "PURCHASE_ORDER", poId != null ? poId.toString() : null);
    }

    @DltHandler
    public void handleDlt(Map<String, Object> event,
                          org.apache.kafka.clients.consumer.ConsumerRecord<?, ?> record) {
        log.error("Message exhausted all retries. Topic: {}, Partition: {}, Offset: {}, Event: {}",
            record.topic(), record.partition(), record.offset(), event);
    }

    // ── CRUD ──────────────────────────────────────────────────────────────────

    @Transactional
    public NotificationResponse createNotification(NotificationRequest request) {
        if (request == null) throw new IllegalArgumentException("Notification request cannot be null");
        Notification notification = new Notification();
        notification.setUserId(request.getUserId());
        notification.setType(request.getType());
        notification.setTitle(request.getTitle());
        notification.setMessage(request.getMessage());
        notification.setCategory(request.getCategory());
        notification.setRelatedEntityId(request.getRelatedEntityId());
        notification.setStatus("PENDING");
        notification.setCreatedAt(LocalDateTime.now());
        Notification saved = notificationRepository.save(notification);
        log.info("Notification created for user {}: {}", request.getUserId(), request.getTitle());
        return mapToResponse(saved);
    }

    public List<NotificationResponse> getUserNotifications(Long userId) {
        try {
            return notificationRepository.findByUserId(userId).stream()
                .map(this::mapToResponse).collect(Collectors.toList());
        } catch (Exception e) {
            log.warn("Could not fetch notifications for user {}: {}", userId, e.getMessage());
            return List.of();
        }
    }

    public List<NotificationResponse> getUnreadNotifications(Long userId) {
        try {
            return notificationRepository.findByUserIdAndStatus(userId, "PENDING").stream()
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

    /** Persists an in-app notification record. userId=null means broadcast/system. */
    @Transactional
    public void saveNotification(Long userId, String type, String title,
                                  String message, String category, String relatedEntityId) {
        try {
            Notification n = new Notification();
            n.setUserId(userId);
            n.setType(type);
            n.setTitle(title);
            n.setMessage(message);
            n.setCategory(category);
            n.setRelatedEntityId(relatedEntityId);
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
            .createdAt(n.getCreatedAt())
            .sentAt(n.getSentAt())
            .readAt(n.getReadAt())
            .build();
    }
}
