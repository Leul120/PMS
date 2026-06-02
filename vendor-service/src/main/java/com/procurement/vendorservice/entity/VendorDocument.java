package com.procurement.vendorservice.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.Filter;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "VendorDocument", indexes = {
    @Index(name = "idx_vendor_doc_tenant_id", columnList = "tenantId")
})
@Filter(name = "tenantFilter", condition = "tenant_id = :tenantId")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class VendorDocument {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long documentId;

    @Column(nullable = false)
    private Long tenantId;

    @ManyToOne
    @JoinColumn(name = "vendorId")
    private Vendor vendor;
    
    private String documentType;

    private String documentName;

    private String originalFilename;

    @Column(columnDefinition = "BYTEA")
    private byte[] fileContent;

    private String contentType;

    private LocalDate issueDate;

    private LocalDate expiryDate;

    private String status; // VALID, EXPIRED, PENDING_VERIFICATION

    private LocalDateTime uploadedAt;

    private String uploadedBy;
}
