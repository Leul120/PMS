package com.procurement.procurementservice.infrastructure.cache;

public final class ProcurementCacheNames {
    private ProcurementCacheNames() {}
    public static final String PREFIX = "procurement-service:";
    public static final String PURCHASE_ORDERS = PREFIX + "purchase-orders";
    public static final String PO_BY_ID = PREFIX + "po:by-id";
    public static final String PURCHASE_REQUISITIONS = PREFIX + "purchase-requisitions";
    public static final String PR_BY_ID = PREFIX + "pr:by-id";
    public static String key(String type, Object id) { return PREFIX + type + ":" + id; }
}
