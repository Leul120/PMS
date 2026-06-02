package com.procurement.deliveryinvoiceservice.dto;

import jakarta.validation.constraints.NotBlank;
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

    /** Audit trail only — optional narrative for disputes. */
    private String qualityRemarks;

    @NotBlank(message = "qualityRating is required (ACCEPTED, ACCEPTED_WITH_ISSUES, REJECTED)")
    private String qualityRating;

    /** Comma-separated issue codes when applicable */
    private String qualityIssueTypes;

    /** Expected/order quantity for short-shipment detection */
    private Integer quantityOrdered;
}
