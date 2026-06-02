package com.procurement.authservice.tenant;

/**
 * ThreadLocal holder for the current request's tenant ID.
 * Must be cleared after every request to prevent leaks across thread-pool threads.
 */
public final class TenantContext {

    private static final ThreadLocal<Long> CURRENT_TENANT = new ThreadLocal<>();

    private TenantContext() {}

    public static void setCurrentTenant(Long tenantId) {
        CURRENT_TENANT.set(tenantId);
    }

    public static Long getCurrentTenant() {
        return CURRENT_TENANT.get();
    }

    public static void clear() {
        CURRENT_TENANT.remove();
    }

    public static Long requireCurrentTenant() {
        Long tenantId = CURRENT_TENANT.get();
        if (tenantId == null) {
            throw new TenantAccessException("No tenant context found for the current request");
        }
        return tenantId;
    }
}
