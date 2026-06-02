package com.procurement.authservice.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class SwitchContextRequest {
    /** PROCUREMENT or SALES */
    @NotBlank
    private String context;
}
