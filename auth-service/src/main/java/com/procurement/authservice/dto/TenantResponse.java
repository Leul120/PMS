package com.procurement.authservice.dto;

import com.procurement.authservice.entity.Tenant;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.Map;

@Data
@Builder
public class TenantResponse {
    private Long tenantId;
    private String name;
    private String domain;
    private Tenant.TenantStatus status;
    private Tenant.SubscriptionPlan subscriptionPlan;
    private Map<String, Object> settings;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private long userCount;
}
