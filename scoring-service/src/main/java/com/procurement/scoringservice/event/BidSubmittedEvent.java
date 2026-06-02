package com.procurement.scoringservice.event;

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
public class BidSubmittedEvent {
    private Long tenantId;
    private Long bidId;
    private Long rfqId;
    private Long vendorId;
    private BigDecimal bidAmount;
    private LocalDateTime submittedAt;
}
