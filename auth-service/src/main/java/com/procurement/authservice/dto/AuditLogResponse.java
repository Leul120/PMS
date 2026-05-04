package com.procurement.authservice.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AuditLogResponse {
    private Long logId;
    private String actionType;
    private String entityAffected;
    private LocalDateTime timestamp;
    private String oldValue;
    private String newValue;
    private Long userId;
}
