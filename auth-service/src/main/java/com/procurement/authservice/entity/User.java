package com.procurement.authservice.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.Filter;
import org.hibernate.annotations.FilterDef;
import org.hibernate.annotations.ParamDef;

import java.time.LocalDateTime;

@Entity
@Table(name = "\"user\"",
    indexes = {
        @Index(name = "idx_user_tenant_id", columnList = "tenant_id"),
        @Index(name = "idx_user_tenant_email", columnList = "tenant_id, email")
    },
    uniqueConstraints = @UniqueConstraint(name = "uk_user_email_tenant", columnNames = {"email", "tenant_id"})
)
@FilterDef(name = "tenantFilter", parameters = @ParamDef(name = "tenantId", type = Long.class))
@Filter(name = "tenantFilter", condition = "tenant_id = :tenantId")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class User {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long userId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "tenant_id", nullable = false)
    private Tenant tenant;

    private String fullName;

    @Column(nullable = false)
    private String email;

    private String phoneNumber;

    private String passwordHash;

    @ManyToOne
    @JoinColumn(name = "roleId")
    private Role role;

    /** Optional supplier-side role for dual-hat users (BOTH orgs) — used in SALES context only. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "supplier_role_id")
    private Role supplierRole;

    private LocalDateTime lastLogin;

    private LocalDateTime registrationDate;

    private Integer failedLoginAttempts = 0;

    private Boolean accountLocked = false;

    private LocalDateTime lockTime;

    private LocalDateTime lastFailedLogin;

    @Column(nullable = false, columnDefinition = "boolean default false")
    private Boolean mustChangePassword = false;

    /** PENDING_APPROVAL | APPROVED | REJECTED — only relevant for VENDOR accounts */
    @Column(nullable = false, columnDefinition = "varchar(20) default 'APPROVED'")
    private String approvalStatus = "APPROVED";

    /** Permanently deactivated by SUPER_ADMIN — cannot log in; cannot be reversed by tenant admins */
    @Column(nullable = false, columnDefinition = "boolean default false")
    private Boolean deactivated = false;

    /** Company name supplied at vendor self-registration */
    private String companyName;
}
