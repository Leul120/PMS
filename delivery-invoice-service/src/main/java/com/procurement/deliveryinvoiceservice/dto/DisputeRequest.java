package com.procurement.deliveryinvoiceservice.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class DisputeRequest {
    @NotNull
    private Long poId;
    
    private Long deliveryId;
    
    private Long invoiceId;
    
    @NotBlank
    private String disputeType; // QUANTITY_MISMATCH, PRICE_MISMATCH, QUALITY_ISSUE, DELAYED_DELIVERY
    
    @NotBlank
    private String description;
}
