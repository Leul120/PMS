package com.procurement.authservice.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.Data;

import java.util.Map;

@Data
public class CreateTenantRequest {

    @NotBlank
    private String name;

    @NotBlank
    @Pattern(regexp = "^[a-z0-9.-]+$", message = "Domain must be lowercase alphanumeric with dots or hyphens")
    private String domain;

    private String subscriptionPlan = "BASIC"; // BASIC, PRO, ENTERPRISE

    private Map<String, Object> settings;
}
