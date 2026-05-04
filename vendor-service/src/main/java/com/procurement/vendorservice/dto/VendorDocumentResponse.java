package com.procurement.vendorservice.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class VendorDocumentResponse {
    private Long documentId;
    private Long vendorId;
    private String documentType;
    private String documentName;
    private String fileUrl;
    private LocalDate issueDate;
    private LocalDate expiryDate;
    private String status;
    private LocalDateTime uploadedAt;
    private String uploadedBy;
}
