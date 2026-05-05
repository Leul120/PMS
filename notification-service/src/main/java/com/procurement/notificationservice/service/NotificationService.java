package com.procurement.notificationservice.service;

import com.procurement.notificationservice.dto.NotificationRequest;
import com.procurement.notificationservice.dto.NotificationResponse;
import com.procurement.notificationservice.entity.Notification;
import com.procurement.notificationservice.repository.NotificationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
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
    
    @KafkaListener(topics = "vendor.verified", groupId = "notification-service-group")
    public void handleVendorVerified(Map<String, Object> event) {
        log.info("Vendor verified notification: {}", event);
        sendEmail((String) event.get("email"), "Vendor Verification", 
            "Your vendor account has been verified!");
    }
    
    @KafkaListener(topics = "rfq.published", groupId = "notification-service-group")
    public void handleRFQPublished(Map<String, Object> event) {
        log.info("RFQ published notification: {}", event);
        // Send notification to eligible vendors
    }
    
    @KafkaListener(topics = "bid.submitted", groupId = "notification-service-group")
    public void handleBidSubmitted(Map<String, Object> event) {
        log.info("Bid submitted notification: {}", event);
        // Notify procurement officer
    }
    
    @KafkaListener(topics = "po.approved", groupId = "notification-service-group")
    public void handlePOApproved(Map<String, Object> event) {
        log.info("PO approved notification: {}", event);
        // Notify vendor
    }
    
    @KafkaListener(topics = "delivery.completed", groupId = "notification-service-group")
    public void handleDeliveryCompleted(Map<String, Object> event) {
        log.info("Delivery completed notification: {}", event);
    }
    
    @KafkaListener(topics = "invoice.discrepancy", groupId = "notification-service-group")
    public void handleInvoiceDiscrepancy(Map<String, Object> event) {
        log.info("Invoice discrepancy notification: {}", event);
        // Notify procurement and finance
    }
    
    @KafkaListener(topics = "score.updated", groupId = "notification-service-group")
    public void handleScoreUpdated(Map<String, Object> event) {
        log.info("Score updated notification: {}", event);
        String riskLevel = (String) event.get("riskLevel");
        if ("High".equals(riskLevel)) {
            // Send alert for high risk vendor
            log.warn("High risk vendor alert: {}", event.get("vendorId"));
        }
    }
    
    private void sendEmail(String to, String subject, String body) {
        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setTo(to);
            message.setSubject(subject);
            message.setText(body);
            mailSender.send(message);
            log.info("Email sent to: {}", to);
        } catch (Exception e) {
            log.error("Failed to send email: {}", e.getMessage());
        }
    }
    
    @Transactional
    public NotificationResponse createNotification(NotificationRequest request) {
        if (request == null) {
            log.error("Cannot create notification: request is null");
            throw new IllegalArgumentException("Notification request cannot be null");
        }

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
        if (saved == null) {
            log.error("Failed to save notification: repository returned null");
            throw new RuntimeException("Failed to create notification");
        }
        log.info("Notification created for user {}: {}", request.getUserId(), request.getTitle());
        return mapToResponse(saved);
    }
    
    public List<NotificationResponse> getUserNotifications(Long userId) {
        return notificationRepository.findByUserId(userId).stream()
            .map(this::mapToResponse)
            .collect(Collectors.toList());
    }
    
    public List<NotificationResponse> getUnreadNotifications(Long userId) {
        return notificationRepository.findByUserIdAndStatus(userId, "PENDING").stream()
            .map(this::mapToResponse)
            .collect(Collectors.toList());
    }
    
    @Transactional
    public NotificationResponse markAsRead(Long notificationId) {
        Notification notification = notificationRepository.findById(notificationId)
            .orElseThrow(() -> new RuntimeException("Notification not found"));
        notification.setStatus("READ");
        notification.setReadAt(LocalDateTime.now());
        return mapToResponse(notificationRepository.save(notification));
    }
    
    @Transactional
    public NotificationResponse sendNotification(Long notificationId) {
        Notification notification = notificationRepository.findById(notificationId)
            .orElseThrow(() -> new RuntimeException("Notification not found"));
        
        if ("EMAIL".equals(notification.getType())) {
            // Get user email from auth service (simplified - would typically call auth service)
            sendEmail("user@example.com", notification.getTitle(), notification.getMessage());
        }
        
        notification.setStatus("SENT");
        notification.setSentAt(LocalDateTime.now());
        return mapToResponse(notificationRepository.save(notification));
    }
    
    @KafkaListener(topics = "bid.deadline.approaching", groupId = "notification-service-group")
    public void handleBidDeadlineApproaching(Map<String, Object> event) {
        log.info("Bid deadline approaching: {}", event);
        Long rfqId = (Long) event.get("rfqId");
        // Notify vendors about approaching deadline
    }
    
    @KafkaListener(topics = "approval.pending", groupId = "notification-service-group")
    public void handleApprovalPending(Map<String, Object> event) {
        log.info("Approval pending: {}", event);
        // Notify managers about pending approvals
    }
    
    private NotificationResponse mapToResponse(Notification notification) {
        if (notification == null) {
            log.error("Cannot map null notification to response");
            throw new IllegalArgumentException("Notification cannot be null");
        }
        return NotificationResponse.builder()
            .notificationId(notification.getNotificationId())
            .userId(notification.getUserId())
            .type(notification.getType())
            .title(notification.getTitle())
            .message(notification.getMessage())
            .status(notification.getStatus())
            .category(notification.getCategory())
            .relatedEntityId(notification.getRelatedEntityId())
            .createdAt(notification.getCreatedAt())
            .sentAt(notification.getSentAt())
            .readAt(notification.getReadAt())
            .build();
    }
}
