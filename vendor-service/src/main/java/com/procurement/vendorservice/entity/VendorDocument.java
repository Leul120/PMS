package com.procurement.vendorservice.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "VendorDocument")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class VendorDocument {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long documentId;
    
    @ManyToOne
    @JoinColumn(name = "vendorId")
    private Vendor vendor;
    
    private String documentType; // LICENSE, TAX_CERT, INSURANCE, etc.
    
    private String documentName;
    
    private String fileUrl;
    
    private LocalDate issueDate;
    
    private LocalDate expiryDate;
    
    private String status; // VALID, EXPIRED, PENDING_VERIFICATION
    
    private LocalDateTime uploadedAt;
    
    private String uploadedBy;
}
