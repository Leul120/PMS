package com.procurement.rfqbiddingservice.event;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class TenantSuspendedEvent {
    private Long tenantId;
    private String tenantDomain;
    private String tenantName;
    private LocalDateTime suspendedAt;
}
