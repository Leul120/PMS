package com.procurement.vendorservice.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.Filter;
import org.hibernate.annotations.FilterDef;
import org.hibernate.annotations.ParamDef;

@Entity
@Table(name = "vendor",
    indexes = {
        @Index(name = "idx_vendor_tenant_id", columnList = "tenant_id"),
        @Index(name = "idx_vendor_tenant_email", columnList = "tenant_id, email"),
        @Index(name = "idx_vendor_compliance", columnList = "compliance_status"),
        @Index(name = "idx_vendor_user_id", columnList = "user_id")
    },
    uniqueConstraints = @UniqueConstraint(name = "uk_vendor_email_tenant", columnNames = {"email", "tenant_id"})
)
@FilterDef(name = "tenantFilter", parameters = @ParamDef(name = "tenantId", type = Long.class))
@Filter(name = "tenantFilter", condition = "tenant_id = :tenantId")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Vendor {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long vendorId;

    @Column(name = "tenant_id", nullable = false)
    private Long tenantId;

    private String companyName;

    private String contactPerson;

    @Column(nullable = false)
    private String email;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "categoryId")
    private VendorCategory category;

    private String complianceStatus;

    private Long userId;

    private String phoneNumber;

    private String address;

    private String taxId;

    @Version
    private Long version;
}
