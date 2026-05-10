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
    // Alias for frontend compatibility
    private Long id;
    private Long rfqId;
    private Long vendorId;
    private String vendorName;
    private BigDecimal bidAmount;
    private String status;
    private LocalDateTime submittedAt;
    private String proposalText;
    private Integer deliveryDays;
    // Alias for frontend compatibility
    private String deliveryTime;
    private BigDecimal qualityScore;
    private BigDecimal totalScore;
    // Alias for frontend compatibility (0-100 percentage)
    private Integer score;
}
