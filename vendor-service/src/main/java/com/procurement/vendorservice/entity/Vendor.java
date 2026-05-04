package com.procurement.vendorservice.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "Vendor")
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
    
    @ManyToOne
    @JoinColumn(name = "categoryId")
    private VendorCategory category;
    
    private String complianceStatus; // "Pending", "Verified", "Rejected"
    
    private Long userId;
    
    private String phoneNumber;
    
    private String address;
    
    private String taxId;
}
