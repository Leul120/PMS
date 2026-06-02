package com.procurement.vendorservice.dto;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class VendorInitRequest {
    private String companyName;
    private String email;
    private String phoneNumber;
    private String contactPerson;
}
