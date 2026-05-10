package com.procurement.vendorservice.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class VendorResponse {
    private Long vendorId;
    // Alias for frontend compatibility
    private Long id;
    private String companyName;
    private String contactPerson;
    private String email;
    private Long categoryId;
    private String categoryName;
    // complianceStatus drives both status and verified on the frontend
    private String complianceStatus;
    // Derived fields for frontend
    private String status;       // maps to complianceStatus
    private Boolean verified;    // true when complianceStatus == "Verified"
    private String phoneNumber;
    // Alias for frontend compatibility
    private String phone;
    private String address;
    private String taxId;
    // category alias for frontend
    private String category;
}
