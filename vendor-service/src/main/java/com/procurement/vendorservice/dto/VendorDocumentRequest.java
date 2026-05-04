package com.procurement.vendorservice.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.time.LocalDate;

@Data
public class VendorDocumentRequest {
    @NotBlank
    private String documentType;
    
    @NotBlank
    private String documentName;
    
    @NotBlank
    private String fileUrl;
    
    private LocalDate issueDate;
    
    @NotNull
    private LocalDate expiryDate;
}
