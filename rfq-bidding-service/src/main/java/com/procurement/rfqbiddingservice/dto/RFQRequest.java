package com.procurement.rfqbiddingservice.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
public class RFQRequest {
    @NotBlank
    private String title;
    
    private String description;
    
    @NotNull
    private LocalDateTime deadline;
    
    private BigDecimal estimatedValue;
    
    private Long categoryId;
    
    private Integer expectedQuantity;

    private Long requisitionId;
}
