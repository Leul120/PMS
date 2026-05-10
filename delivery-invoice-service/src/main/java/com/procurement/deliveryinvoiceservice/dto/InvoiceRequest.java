package com.procurement.deliveryinvoiceservice.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class InvoiceRequest {
    @NotNull
    private Long poId;

    @NotNull
    @Positive
    private BigDecimal invoiceAmount;

    @NotNull
    private Long vendorId;
}
