package com.procurement.deliveryinvoiceservice.event;

import lombok.Builder;
import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@Builder
public class InvoiceDiscrepancyEvent {
    private Long invoiceId;
    private Long poId;
    private BigDecimal invoiceAmount;
    private BigDecimal expectedAmount;
    private String discrepancyReason;
    private LocalDateTime detectedAt;
}
