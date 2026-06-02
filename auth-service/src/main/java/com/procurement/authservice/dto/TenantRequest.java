package com.procurement.authservice.dto;

import com.procurement.authservice.entity.Tenant;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.Map;

@Data
public class TenantRequest {

    @NotBlank
    private String name;

    @NotBlank
    private String domain;

    @NotNull
    private Tenant.TenantStatus status;

    @NotNull
    private Tenant.SubscriptionPlan subscriptionPlan;

    private Map<String, Object> settings;
}
