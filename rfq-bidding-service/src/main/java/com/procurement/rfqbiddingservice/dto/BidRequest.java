package com.procurement.rfqbiddingservice.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class BidRequest {
    @NotNull
    private Long rfqId;
    
    @NotNull
    private Long vendorId;
    
    @NotNull
    @Positive
    private BigDecimal bidAmount;
    
    private String proposalText;
    
    private Integer deliveryDays;
}
