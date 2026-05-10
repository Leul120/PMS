package com.procurement.deliveryinvoiceservice.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;

@Data
public class DeliveryRequest {
    @NotNull
    private Long poId;

    @NotNull
    private Long vendorId;

    private LocalDate expectedDate;

    private LocalDate actualDate;

    @NotNull
    private Integer quantityDelivered;

    private String issueNotes;

    private String qualityRemarks;
}
