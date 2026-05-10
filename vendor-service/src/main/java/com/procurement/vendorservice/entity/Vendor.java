package com.procurement.vendorservice.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "Vendor", indexes = {
    @Index(name = "idx_vendor_email", columnList = "email"),
    @Index(name = "idx_vendor_compliance", columnList = "complianceStatus"),
    @Index(name = "idx_vendor_user_id", columnList = "userId")
})
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Vendor {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long vendorId;

    private String companyName;

    private String contactPerson;

    @Column(unique = true)
    private String email;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "categoryId")
    private VendorCategory category;

    private String complianceStatus; // "Pending", "Verified", "Rejected"

    private Long userId;

    private String phoneNumber;

    private String address;

    private String taxId;

    /** Optimistic locking — prevents concurrent verification conflicts. */
    @Version
    private Long version;
}
