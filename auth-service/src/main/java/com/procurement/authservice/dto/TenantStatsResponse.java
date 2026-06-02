package com.procurement.authservice.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TenantStatsResponse {
    private long totalTenants;
    private long activeTenants;
    private long suspendedTenants;
    private long totalUsers;
}
