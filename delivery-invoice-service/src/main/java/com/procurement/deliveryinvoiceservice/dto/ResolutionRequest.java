package com.procurement.deliveryinvoiceservice.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class ResolutionRequest {
    @NotBlank
    private String resolution;
}
