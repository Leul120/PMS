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
public class InvoiceDiscrepancyEvent {
    private Long tenantId;
    private Long invoiceId;
    private Long poId;
    private BigDecimal invoiceAmount;
    private BigDecimal expectedAmount;
    private String discrepancyReason;
    private LocalDateTime detectedAt;
}
