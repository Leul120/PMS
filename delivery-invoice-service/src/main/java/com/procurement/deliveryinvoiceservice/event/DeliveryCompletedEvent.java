package com.procurement.deliveryinvoiceservice.event;

import lombok.Builder;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Builder
public class DeliveryCompletedEvent {
    private Long tenantId;
    private Long deliveryId;
    private Long poId;
    private Long vendorId;
    private Integer delayDays;
    private Integer expectedDays;
    private Integer quantityDelivered;
    private Integer quantityOrdered;
    private String qualityRemarks;
    private String qualityRating;
    private String qualityIssueTypes;
    private LocalDateTime completedAt;
}
