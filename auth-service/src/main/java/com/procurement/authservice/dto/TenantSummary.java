package com.procurement.authservice.dto;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class TenantSummary {
    private Long tenantId;
    private String name;
    private String domain;
    private String status;
}
