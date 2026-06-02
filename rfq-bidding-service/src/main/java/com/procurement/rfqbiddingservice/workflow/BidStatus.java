package com.procurement.rfqbiddingservice.workflow;

public final class BidStatus {
    public static final String SUBMITTED = "Submitted";
    public static final String PENDING = "Pending";
    public static final String EVALUATED = "Evaluated";
    public static final String AWARDED = "Awarded";
    public static final String REJECTED = "Rejected";
    public static final String WITHDRAWN = "Withdrawn";

    private BidStatus() {}

    public static boolean isEvaluable(String status) {
        return SUBMITTED.equals(status) || PENDING.equals(status);
    }

    public static boolean isActive(String status) {
        return isEvaluable(status);
    }
}
