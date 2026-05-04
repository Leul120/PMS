package com.procurement.authservice.service;

import com.procurement.authservice.dto.AuditLogResponse;
import com.procurement.authservice.entity.AuditLog;
import com.procurement.authservice.infrastructure.cache.AuthCacheNames;
import com.procurement.authservice.repository.AuditLogRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class AuditLogService {
    
    private final AuditLogRepository auditLogRepository;
    
    @CacheEvict(value = "auditLogs", allEntries = true)
    @Transactional
    public void logAction(String actionType, String entityAffected, String oldValue,
                          String newValue, Long userId) {
        AuditLog auditLog = new AuditLog();
        auditLog.setActionType(actionType);
        auditLog.setEntityAffected(entityAffected);
        auditLog.setOldValue(oldValue);
        auditLog.setNewValue(newValue);
        auditLog.setUserId(userId);
        auditLog.setTimestamp(LocalDateTime.now());

        auditLogRepository.save(auditLog);
        log.info("Audit log created: {} on {} by user {}", actionType, entityAffected, userId);
    }

    @Cacheable(value = "auditLogs", key = "'all'")
    @Transactional(readOnly = true)
    public List<AuditLogResponse> getAllAuditLogs() {
        return auditLogRepository.findTop100ByOrderByTimestampDesc()
            .stream()
            .map(this::mapToResponse)
            .collect(Collectors.toList());
    }

    @Cacheable(value = "auditLogs", key = AuthCacheNames.AUDIT_LOGS + ":user:#userId")
    @Transactional(readOnly = true)
    public List<AuditLogResponse> getAuditLogsByUser(Long userId) {
        return auditLogRepository.findByUserIdOrderByTimestampDesc(userId)
            .stream()
            .map(this::mapToResponse)
            .collect(Collectors.toList());
    }
    
    private AuditLogResponse mapToResponse(AuditLog log) {
        return AuditLogResponse.builder()
            .logId(log.getLogId())
            .actionType(log.getActionType())
            .entityAffected(log.getEntityAffected())
            .timestamp(log.getTimestamp())
            .oldValue(log.getOldValue())
            .newValue(log.getNewValue())
            .userId(log.getUserId())
            .build();
    }
}
