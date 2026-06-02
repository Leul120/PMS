package com.procurement.authservice.entity;

import com.procurement.authservice.domain.OrganizationType;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;
import java.util.Map;

@Entity
@Table(name = "Tenant", indexes = {
    @Index(name = "idx_tenant_domain", columnList = "domain"),
    @Index(name = "idx_tenant_status", columnList = "status")
})
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Tenant {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long tenantId;

    @Column(nullable = false)
    private String name;

    @Column(unique = true, nullable = false)
    private String domain;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private TenantStatus status;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private SubscriptionPlan subscriptionPlan;

    /** BUYER, SUPPLIER, or BOTH (enterprise trading partner). */
    @Enumerated(EnumType.STRING)
    @Column(name = "organization_type")
    @Builder.Default
    private OrganizationType organizationType = OrganizationType.BUYER;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private Map<String, Object> settings;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    @PrePersist
    void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    public enum TenantStatus {
        ACTIVE, SUSPENDED, TRIAL
    }

    public enum SubscriptionPlan {
        BASIC, PRO, ENTERPRISE
    }
}
