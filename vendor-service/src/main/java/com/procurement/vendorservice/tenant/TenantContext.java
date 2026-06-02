package com.procurement.vendorservice.tenant;

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
