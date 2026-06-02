package com.procurement.procurementservice.tenant;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import lombok.extern.slf4j.Slf4j;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.hibernate.Session;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

/**
 * Enables the Hibernate "tenantFilter" on every public service method so that
 * all JPA queries automatically include a WHERE tenantId = :tenantId clause.
 * SUPER_ADMIN bypasses the filter to retain platform-wide visibility.
 */
@Aspect
@Component
@Slf4j
public class TenantAspect {

    @PersistenceContext
    private EntityManager entityManager;

    @Around("execution(public * com.procurement.procurementservice.service..*(..))")
    public Object applyTenantFilter(ProceedingJoinPoint pjp) throws Throwable {
        Long tenantId = TenantContext.getCurrentTenant();
        boolean isSuperAdmin = isSuperAdmin();
        // SUPER_ADMIN bypasses the Hibernate filter but keeps tenant context for writes
        boolean applyFilter = tenantId != null && !isSuperAdmin;

        if (applyFilter) {
            Session session = entityManager.unwrap(Session.class);
            session.enableFilter("tenantFilter").setParameter("tenantId", tenantId);
            log.debug("Tenant filter applied: tenantId={}", tenantId);
        }

        try {
            return pjp.proceed();
        } finally {
            if (applyFilter) {
                entityManager.unwrap(Session.class).disableFilter("tenantFilter");
            }
        }
    }

    private boolean isSuperAdmin() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null) return false;
        return auth.getAuthorities().stream()
            .anyMatch(a -> "ROLE_SUPER_ADMIN".equals(a.getAuthority()));
    }
}
