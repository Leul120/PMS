package com.procurement.vendorservice.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class VendorRequest {
    @NotBlank
    private String companyName;
    
    @NotBlank
    private String contactPerson;
    
    @NotBlank
    @Email
    private String email;
    
    @NotNull
    private Long categoryId;
    
    private String phoneNumber;
    
    private String address;
    
    private String taxId;
}
