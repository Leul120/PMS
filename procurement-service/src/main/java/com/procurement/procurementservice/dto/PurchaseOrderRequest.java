package com.procurement.procurementservice.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;

@Data
public class PurchaseOrderRequest {
    @NotNull
    private Long rfqId;
    
    @NotNull
    private Long vendorId;
    
    @NotNull
    @Positive
    private BigDecimal totalAmount;
    
    private LocalDate expectedDeliveryDate;
    
    private Long bidId;
}
