package com.procurement.deliveryinvoiceservice.workflow;

import java.util.Map;
import java.util.Set;

public final class InvoiceStatus {
    public static final String PENDING = "Pending";
    public static final String APPROVED = "Approved";
    public static final String DISPUTED = "Disputed";
    public static final String REJECTED = "Rejected";
    public static final String PAID = "Paid";

    private static final Map<String, Set<String>> TRANSITIONS = Map.of(
        PENDING, Set.of(APPROVED, DISPUTED, REJECTED),
        APPROVED, Set.of(PAID, DISPUTED),
        DISPUTED, Set.of(APPROVED, REJECTED),
        REJECTED, Set.of(),
        PAID, Set.of()
    );

    private InvoiceStatus() {}

    public static void validateTransition(String from, String to) {
        if (from == null || to == null) {
            throw new RuntimeException("Invalid invoice status transition: null status");
        }
        if (from.equals(to)) return;
        Set<String> allowed = TRANSITIONS.get(from);
        if (allowed == null || !allowed.contains(to)) {
            throw new RuntimeException("Invalid invoice status transition: " + from + " → " + to);
        }
    }
}
