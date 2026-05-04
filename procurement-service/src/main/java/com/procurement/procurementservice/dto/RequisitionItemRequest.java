package com.procurement.procurementservice.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class RequisitionItemRequest {
    @NotBlank
    private String itemName;
    
    private String description;
    
    @NotNull
    @Positive
    private Integer quantity;
    
    private String unit;
    
    @NotNull
    @Positive
    private BigDecimal estimatedUnitPrice;
    
    private String category;
}
