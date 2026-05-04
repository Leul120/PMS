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
public class BidResponse {
    private Long bidId;
    private Long rfqId;
    private Long vendorId;
    private BigDecimal bidAmount;
    private String status;
    private LocalDateTime submittedAt;
    private String proposalText;
    private Integer deliveryDays;
    private BigDecimal qualityScore;
    private BigDecimal totalScore;
}
