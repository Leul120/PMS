package com.procurement.authservice.infrastructure.cache;

/**
 * Auth Service specific cache names.
 */
public final class AuthCacheNames {

    private AuthCacheNames() {}

    public static final String PREFIX = "auth-service:";

    public static final String USERS = PREFIX + "users";
    public static final String USER_BY_ID = PREFIX + "users:by-id";
    public static final String USER_BY_EMAIL = PREFIX + "users:by-email";
    public static final String ROLES = PREFIX + "roles";
    public static final String ROLE_BY_NAME = PREFIX + "roles:by-name";
    public static final String AUDIT_LOGS = PREFIX + "audit-logs";
    public static final String USER_PERMISSIONS = PREFIX + "user-permissions";

    public static String key(String type, Object identifier) {
        return PREFIX + type + ":" + identifier;
    }
}
