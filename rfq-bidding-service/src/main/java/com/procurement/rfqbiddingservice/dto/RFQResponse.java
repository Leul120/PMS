package com.procurement.rfqbiddingservice.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RFQResponse {
    private Long rfqId;
    // Alias for frontend compatibility
    private Long id;
    private String rfqNumber;
    private String title;
    private String description;
    private LocalDateTime deadline;
    private String status;
    private Long createdBy;
    private LocalDateTime createdAt;
    private BigDecimal estimatedValue;
    // Alias for frontend compatibility
    private BigDecimal maxBudget;
    private Long categoryId;
    private String categoryName;
    // Alias for frontend compatibility
    private String category;
    private Integer expectedQuantity;
    private Integer bidCount;
}
