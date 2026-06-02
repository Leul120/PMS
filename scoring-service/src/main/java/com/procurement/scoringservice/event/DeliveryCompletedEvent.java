package com.procurement.scoringservice.event;

import lombok.Data;
import java.time.LocalDateTime;

@Data
public class DeliveryCompletedEvent {
    private Long tenantId;
    private Long deliveryId;
    private Long poId;
    private Long vendorId;
    private Integer delayDays;
    private Integer expectedDays;   // actual PO delivery window in days
    private Integer quantityDelivered;
    private Integer quantityOrdered;
    private String qualityRemarks;
    private String qualityRating;
    private String qualityIssueTypes;
    private LocalDateTime completedAt;
}
