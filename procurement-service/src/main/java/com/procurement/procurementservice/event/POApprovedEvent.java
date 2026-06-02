package com.procurement.procurementservice.event;

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
public class POApprovedEvent {
    private Long tenantId;
    private Long poId;
    private Long rfqId;
    private Long vendorId;
    private BigDecimal totalAmount;
    private Long approvedBy;
    private LocalDateTime approvedAt;
    private String vendorEmail;
    private String vendorName;
}
