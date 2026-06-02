package com.procurement.authservice.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "AuditLog", indexes = {
    @Index(name = "idx_audit_tenant_id", columnList = "tenantId"),
    @Index(name = "idx_audit_tenant_user", columnList = "tenantId,userId")
})
@Data
@NoArgsConstructor
@AllArgsConstructor
public class AuditLog {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long logId;

    @Column(nullable = false)
    private Long tenantId;

    private String actionType;

    private String entityAffected;

    private LocalDateTime timestamp;

    @Column(columnDefinition = "TEXT")
    private String oldValue;

    @Column(columnDefinition = "TEXT")
    private String newValue;

    private Long userId;
}
