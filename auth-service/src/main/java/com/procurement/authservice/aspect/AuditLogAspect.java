package com.procurement.authservice.aspect;

import com.procurement.authservice.service.AuditLogService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.aspectj.lang.JoinPoint;
import org.aspectj.lang.annotation.AfterReturning;
import org.aspectj.lang.annotation.AfterThrowing;
import org.aspectj.lang.annotation.Aspect;
import org.aspectj.lang.annotation.Before;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import jakarta.servlet.http.HttpServletRequest;
import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.stream.Collectors;

@Aspect
@Component
@Slf4j
@RequiredArgsConstructor
public class AuditLogAspect {

    private final AuditLogService auditLogService;

    @Before("@annotation(com.procurement.authservice.aspect.Auditable)")
    public void logBefore(JoinPoint joinPoint) {
        try {
            String action = extractAction(joinPoint);
            String entityType = extractEntityType(joinPoint);
            String entityId = extractEntityId(joinPoint);
            String description = buildDescription(joinPoint, "INITIATED");
            Long userId = getCurrentUserId();

            log.info("Audit - Action: {}, User: {}, Entity: {}:{}, Description: {}", 
                    action, userId, entityType, entityId, description);
        } catch (Exception e) {
            log.error("Error in audit log before aspect", e);
        }
    }

    @AfterReturning(pointcut = "@annotation(com.procurement.authservice.aspect.Auditable)", returning = "result")
    public void logAfterReturning(JoinPoint joinPoint, Object result) {
        try {
            String action = extractAction(joinPoint);
            String entityType = extractEntityType(joinPoint);
            String entityId = extractEntityId(joinPoint);
            String description = buildDescription(joinPoint, "COMPLETED");
            Long userId = getCurrentUserId();

            auditLogService.logAction(action, entityType, entityId, description, userId);
            log.info("Audit logged - Action: {}, User: {}, Entity: {}:{}", 
                    action, userId, entityType, entityId);
        } catch (Exception e) {
            log.error("Error in audit log after returning aspect", e);
        }
    }

    @AfterThrowing(pointcut = "@annotation(com.procurement.authservice.aspect.Auditable)", throwing = "exception")
    public void logAfterThrowing(JoinPoint joinPoint, Exception exception) {
        try {
            String action = extractAction(joinPoint);
            String entityType = extractEntityType(joinPoint);
            String entityId = extractEntityId(joinPoint);
            String description = buildDescription(joinPoint, "FAILED: " + exception.getMessage());
            Long userId = getCurrentUserId();

            auditLogService.logAction(action, entityType, entityId, description, userId);
            log.warn("Audit logged (failure) - Action: {}, User: {}, Entity: {}:{}, Error: {}", 
                    action, userId, entityType, entityId, exception.getMessage());
        } catch (Exception e) {
            log.error("Error in audit log after throwing aspect", e);
        }
    }

    private String extractAction(JoinPoint joinPoint) {
        String methodName = joinPoint.getSignature().getName();
        String className = joinPoint.getTarget().getClass().getSimpleName();
        
        // Map method names to action types
        if (methodName.startsWith("create") || methodName.startsWith("register") || methodName.startsWith("add")) {
            return "CREATE";
        } else if (methodName.startsWith("update") || methodName.startsWith("modify") || methodName.startsWith("edit")) {
            return "UPDATE";
        } else if (methodName.startsWith("delete") || methodName.startsWith("remove")) {
            return "DELETE";
        } else if (methodName.startsWith("approve")) {
            return "APPROVE";
        } else if (methodName.startsWith("reject")) {
            return "REJECT";
        } else if (methodName.startsWith("verify")) {
            return "VERIFY";
        } else if (methodName.startsWith("submit")) {
            return "SUBMIT";
        } else if (methodName.startsWith("close")) {
            return "CLOSE";
        } else if (methodName.startsWith("get") || methodName.startsWith("find") || methodName.startsWith("list") || methodName.startsWith("view")) {
            return "READ";
        }
        
        return methodName.toUpperCase();
    }

    private String extractEntityType(JoinPoint joinPoint) {
        String className = joinPoint.getTarget().getClass().getSimpleName();
        
        // Remove "Controller" suffix
        if (className.endsWith("Controller")) {
            className = className.substring(0, className.length() - "Controller".length());
        }
        
        return className.toUpperCase();
    }

    private String extractEntityId(JoinPoint joinPoint) {
        Object[] args = joinPoint.getArgs();
        
        // Look for ID parameters (usually Long or String, often named with "Id")
        for (Object arg : args) {
            if (arg instanceof Long) {
                return arg.toString();
            }
            if (arg instanceof String) {
                String str = (String) arg;
                // Check if it looks like an ID (numeric)
                if (str.matches("\\d+")) {
                    return str;
                }
            }
        }
        
        return null;
    }

    private String buildDescription(JoinPoint joinPoint, String status) {
        String methodName = joinPoint.getSignature().getName();
        String args = Arrays.stream(joinPoint.getArgs())
                .map(Object::toString)
                .collect(Collectors.joining(", "));
        
        HttpServletRequest request = getCurrentRequest();
        String endpoint = request != null ? request.getRequestURI() : "unknown";
        String httpMethod = request != null ? request.getMethod() : "unknown";
        
        return String.format("%s %s - Status: %s - Args: [%s] - Endpoint: %s %s",
                httpMethod, methodName, status, args, httpMethod, endpoint);
    }

    private Long getCurrentUserId() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && authentication.isAuthenticated() && !"anonymousUser".equals(authentication.getPrincipal())) {
            try {
                // Extract user ID from JWT claims or principal
                String principal = authentication.getName();
                if (principal != null && principal.matches("\\d+")) {
                    return Long.parseLong(principal);
                }
            } catch (Exception e) {
                log.warn("Could not extract user ID from authentication");
            }
        }
        return null;
    }

    private HttpServletRequest getCurrentRequest() {
        try {
            ServletRequestAttributes attributes = (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
            return attributes != null ? attributes.getRequest() : null;
        } catch (Exception e) {
            return null;
        }
    }
}
