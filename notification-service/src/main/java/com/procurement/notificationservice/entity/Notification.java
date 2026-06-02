package com.procurement.notificationservice.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.Filter;
import org.hibernate.annotations.FilterDef;
import org.hibernate.annotations.ParamDef;

import java.time.LocalDateTime;

@Entity
@Table(name = "Notification", indexes = {
    @Index(name = "idx_notification_tenant_id", columnList = "tenantId"),
    @Index(name = "idx_notification_tenant_user", columnList = "tenantId, userId"),
    @Index(name = "idx_notification_user_id", columnList = "userId"),
    @Index(name = "idx_notification_status", columnList = "status"),
    @Index(name = "idx_notification_user_status", columnList = "userId, status"),
    @Index(name = "idx_notification_created_at", columnList = "createdAt DESC")
})
@FilterDef(name = "tenantFilter", parameters = @ParamDef(name = "tenantId", type = Long.class))
@Filter(name = "tenantFilter", condition = "tenant_id = :tenantId")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Notification {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long notificationId;

    @Column(nullable = false)
    private Long tenantId;

    private Long userId;
    private String type;
    private String title;

    @Column(columnDefinition = "TEXT")
    private String message;

    private String status;
    private String category;
    private String relatedEntityId;
    private String actionUrl;

    private LocalDateTime createdAt;
    private LocalDateTime sentAt;
    private LocalDateTime readAt;
}
