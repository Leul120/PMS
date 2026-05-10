package com.procurement.notificationservice.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "Notification", indexes = {
    @Index(name = "idx_notification_user_id", columnList = "userId"),
    @Index(name = "idx_notification_status", columnList = "status"),
    @Index(name = "idx_notification_user_status", columnList = "userId, status"),
    @Index(name = "idx_notification_created_at", columnList = "createdAt DESC")
})
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Notification {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long notificationId;

    private Long userId;

    private String type; // EMAIL, IN_APP, SMS

    private String title;

    @Column(columnDefinition = "TEXT")
    private String message;

    private String status; // PENDING, SENT, FAILED, READ

    private String category; // BID_DEADLINE, APPROVAL_PENDING, DELIVERY_UPDATE, VENDOR_ALERT

    private String relatedEntityId; // ID of related RFQ, PO, etc. (stored as String for flexibility)

    private LocalDateTime createdAt;
    private LocalDateTime sentAt;
    private LocalDateTime readAt;
}
