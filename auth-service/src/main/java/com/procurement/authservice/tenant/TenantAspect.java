package com.procurement.authservice.tenant;

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

@Aspect
@Component
@Slf4j
public class TenantAspect {

    @PersistenceContext
    private EntityManager entityManager;

    @Around("execution(public * com.procurement.authservice.service..*(..))")
    public Object applyTenantFilter(ProceedingJoinPoint pjp) throws Throwable {
        Long tenantId = TenantContext.getCurrentTenant();
        boolean isSuperAdmin = isSuperAdmin();
        boolean applyFilter = tenantId != null && !isSuperAdmin;
        // For SUPER_ADMIN: clear TenantContext so service-layer assertSameTenant()
        // and getAllUsers() tenant checks behave as "no restriction". Restore afterward
        // so the ThreadLocal is consistent for the rest of the request lifecycle.
        boolean clearedForSuperAdmin = isSuperAdmin && tenantId != null;

        if (applyFilter) {
            Session session = entityManager.unwrap(Session.class);
            session.enableFilter("tenantFilter").setParameter("tenantId", tenantId);
            log.debug("Tenant filter applied: tenantId={}", tenantId);
        } else if (clearedForSuperAdmin) {
            TenantContext.clear();
            log.debug("SUPER_ADMIN — tenant filter bypassed, tenant context cleared");
        }

        try {
            return pjp.proceed();
        } finally {
            if (applyFilter) {
                entityManager.unwrap(Session.class).disableFilter("tenantFilter");
            } else if (clearedForSuperAdmin) {
                TenantContext.setCurrentTenant(tenantId);
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
