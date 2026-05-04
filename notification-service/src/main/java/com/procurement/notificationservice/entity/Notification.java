package com.procurement.notificationservice.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "Notification")
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
    
    private Long relatedEntityId; // ID of related RFQ, PO, etc.
    
    private LocalDateTime createdAt;
    
    private LocalDateTime sentAt;
    
    private LocalDateTime readAt;
}
