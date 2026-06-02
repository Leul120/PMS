package com.procurement.authservice.event;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TenantSuspendedEvent {
    private Long tenantId;
    private String tenantDomain;
    private String tenantName;
    private LocalDateTime suspendedAt;
}
