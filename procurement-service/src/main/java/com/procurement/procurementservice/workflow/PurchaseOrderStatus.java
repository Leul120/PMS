package com.procurement.procurementservice.workflow;

import java.util.Map;
import java.util.Set;

public final class PurchaseOrderStatus {
    public static final String DRAFT = "Draft";
    public static final String PENDING_APPROVAL = "Pending Approval";
    public static final String APPROVED = "Approved";
    public static final String REJECTED = "Rejected";
    public static final String DELIVERED = "Delivered";
    public static final String CLOSED = "Closed";

    private static final Map<String, Set<String>> TRANSITIONS = Map.of(
        DRAFT, Set.of(PENDING_APPROVAL, APPROVED, REJECTED),
        PENDING_APPROVAL, Set.of(APPROVED, REJECTED),
        APPROVED, Set.of(DELIVERED, CLOSED, REJECTED),
        DELIVERED, Set.of(CLOSED),
        REJECTED, Set.of(),
        CLOSED, Set.of()
    );

    private PurchaseOrderStatus() {}

    public static void validateTransition(String from, String to) {
        if (from == null || to == null) {
            throw new RuntimeException("Invalid PO status transition: null status");
        }
        if (from.equals(to)) return;
        Set<String> allowed = TRANSITIONS.get(from);
        if (allowed == null || !allowed.contains(to)) {
            throw new RuntimeException("Invalid PO status transition: " + from + " → " + to);
        }
    }
}
