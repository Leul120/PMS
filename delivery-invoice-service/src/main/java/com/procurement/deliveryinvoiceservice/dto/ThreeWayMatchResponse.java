package com.procurement.deliveryinvoiceservice.dto;

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
public class ThreeWayMatchResponse {
    private Long matchId;
    private Long poId;
    private Long deliveryId;
    private Long invoiceId;
    private BigDecimal poAmount;
    private Integer poQuantity;
    private BigDecimal invoiceAmount;
    private Integer deliveryQuantity;
    private Boolean quantityMatch;
    private Boolean priceMatch;
    private String status;
    private String mismatchReason;
    private LocalDateTime validatedAt;
}
