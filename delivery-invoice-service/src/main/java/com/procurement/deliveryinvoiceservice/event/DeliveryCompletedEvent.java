package com.procurement.deliveryinvoiceservice.event;

import lombok.Builder;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Builder
public class DeliveryCompletedEvent {
    private Long deliveryId;
    private Long poId;
    private Long vendorId;
    private Integer delayDays;
    private Integer quantityDelivered;
    private String qualityRemarks;
    private LocalDateTime completedAt;
}
