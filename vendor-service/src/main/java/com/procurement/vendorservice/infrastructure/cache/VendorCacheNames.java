package com.procurement.vendorservice.infrastructure.cache;

/**
 * Vendor Service specific cache names.
 * Each service owns its cache namespace to prevent collisions.
 */
public final class VendorCacheNames {

    private VendorCacheNames() {}

    // Prefix with service name to avoid collisions
    public static final String PREFIX = "vendor-service:";

    public static final String VENDORS = PREFIX + "vendors";
    public static final String VENDOR_BY_ID = PREFIX + "vendors:by-id";
    public static final String VENDOR_BY_CODE = PREFIX + "vendors:by-code";
    public static final String VENDOR_CATEGORIES = PREFIX + "vendors:categories";
    public static final String VENDOR_SCORES = PREFIX + "vendors:scores";
    public static final String VENDOR_SEARCH = PREFIX + "vendors:search";

    /**
     * Build cache key with service prefix
     */
    public static String key(String type, Object identifier) {
        return PREFIX + type + ":" + identifier;
    }
}
