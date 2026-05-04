package com.procurement.scoringservice.event;

import lombok.Data;
import java.time.LocalDateTime;

@Data
public class DeliveryCompletedEvent {
    private Long deliveryId;
    private Long poId;
    private Long vendorId;
    private Integer delayDays;
    private Integer quantityDelivered;
    private String qualityRemarks;
    private LocalDateTime completedAt;
}
