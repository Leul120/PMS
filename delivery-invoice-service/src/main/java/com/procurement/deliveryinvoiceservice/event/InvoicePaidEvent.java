package com.procurement.deliveryinvoiceservice.event;

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
public class InvoicePaidEvent {
    private Long tenantId;
    private Long invoiceId;
    private Long poId;
    private Long vendorId;
    private BigDecimal invoiceAmount;
    private Long markedPaidBy;
    private LocalDateTime paidAt;
}
