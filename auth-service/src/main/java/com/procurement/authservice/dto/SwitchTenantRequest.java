package com.procurement.authservice.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class SwitchTenantRequest {
    @NotBlank
    private String tenantDomain;
}
