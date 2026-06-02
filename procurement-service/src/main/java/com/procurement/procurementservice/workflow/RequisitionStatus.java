package com.procurement.procurementservice.workflow;

import java.util.Map;
import java.util.Set;

public final class RequisitionStatus {
    public static final String DRAFT = "DRAFT";
    public static final String PENDING_APPROVAL = "PENDING_APPROVAL";
    public static final String APPROVED = "APPROVED";
    public static final String REJECTED = "REJECTED";

    private static final Map<String, Set<String>> TRANSITIONS = Map.of(
        DRAFT, Set.of(PENDING_APPROVAL),
        PENDING_APPROVAL, Set.of(APPROVED, REJECTED),
        APPROVED, Set.of(),
        REJECTED, Set.of(DRAFT)
    );

    private RequisitionStatus() {}

    public static void validateTransition(String from, String to) {
        if (from == null || to == null) {
            throw new RuntimeException("Invalid requisition status transition: null status");
        }
        if (from.equals(to)) return;
        Set<String> allowed = TRANSITIONS.get(from);
        if (allowed == null || !allowed.contains(to)) {
            throw new RuntimeException("Invalid requisition status transition: " + from + " → " + to);
        }
    }
}
