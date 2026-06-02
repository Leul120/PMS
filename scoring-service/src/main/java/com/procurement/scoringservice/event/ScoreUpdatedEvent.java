package com.procurement.scoringservice.event;

import lombok.Builder;
import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@Builder
public class ScoreUpdatedEvent {
    private Long tenantId;
    private Long vendorId;
    private BigDecimal overallScore;
    private String riskLevel;
    private LocalDateTime updatedAt;
}
