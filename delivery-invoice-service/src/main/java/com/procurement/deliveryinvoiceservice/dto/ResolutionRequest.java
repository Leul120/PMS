package com.procurement.deliveryinvoiceservice.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class ResolutionRequest {
    @NotBlank
    private String resolution;

    /** APPROVE_INVOICE or REJECT_INVOICE — determines linked invoice outcome. */
    @NotBlank
    private String outcome;
}
