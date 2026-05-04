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
    private String companyName;
    private String contactPerson;
    private String email;
    private Long categoryId;
    private String categoryName;
    private String complianceStatus;
    private String phoneNumber;
    private String address;
    private String taxId;
}
