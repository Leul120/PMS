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
    private String title;
    private String description;
    private LocalDateTime deadline;
    private String status;
    private Long createdBy;
    private LocalDateTime createdAt;
    private BigDecimal estimatedValue;
    private Long categoryId;
    private Integer expectedQuantity;
}
