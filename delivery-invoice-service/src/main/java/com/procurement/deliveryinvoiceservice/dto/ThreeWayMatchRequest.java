package com.procurement.deliveryinvoiceservice.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class ThreeWayMatchRequest {
    @NotNull
    private Long poId;

    @NotNull
    private Long deliveryId;

    @NotNull
    private Long invoiceId;

    @NotNull
    private BigDecimal poAmount;

    @NotNull
    private Integer poQuantity;
}
