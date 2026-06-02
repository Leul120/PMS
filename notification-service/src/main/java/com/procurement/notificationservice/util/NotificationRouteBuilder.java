package com.procurement.notificationservice.util;

/**
 * Builds frontend deep-link paths for in-app notifications.
 */
public final class NotificationRouteBuilder {

    private NotificationRouteBuilder() {}

    public static String build(String category, String relatedEntityId, String title) {
        return build(category, relatedEntityId, title, null);
    }

    public static String build(String category, String relatedEntityId, String title, Long poId) {
        if (category == null || category.isBlank()) {
            return "/notifications";
        }
        String id = relatedEntityId != null && !relatedEntityId.isBlank() ? relatedEntityId : null;
        String titleLower = title != null ? title.toLowerCase() : "";

        return switch (category.toUpperCase()) {
            case "BID_DEADLINE", "RFQ", "BID" -> id != null ? "/rfq?id=" + id : "/rfq";
            case "APPROVAL_PENDING", "PURCHASE_ORDER" -> resolveApprovalRoute(id, titleLower);
            case "DELIVERY" -> resolveDeliveryRoute(id, poId, false);
            case "DELIVERY_UPDATE" -> resolveDeliveryRoute(id, poId, true);
            case "INVOICE" -> id != null ? "/invoices?id=" + id : "/invoices";
            case "DISPUTE" -> poId != null ? "/invoices?poId=" + poId
                : (id != null ? "/invoices?disputeId=" + id : "/invoices");
            case "INVENTORY" -> id != null ? "/inventory?id=" + id : "/inventory";
            case "VENDOR_ALERT", "VENDOR_MANAGEMENT", "COMPLIANCE" -> resolveVendorRoute(id, titleLower);
            default -> "/notifications";
        };
    }

    private static String resolveApprovalRoute(String id, String titleLower) {
        if (id == null) {
            return titleLower.contains("requisition") || titleLower.contains("pr-")
                ? "/requisitions"
                : "/procurement";
        }
        if (titleLower.contains("requisition") || titleLower.contains("pr-")) {
            return "/requisitions?id=" + id;
        }
        if (titleLower.contains("report") || titleLower.contains("spend") || titleLower.contains("analytics")) {
            return "/analytics";
        }
        return "/procurement?id=" + id;
    }

    private static String resolveDeliveryRoute(String id, Long poId, boolean idIsPoId) {
        if (poId != null) {
            return "/deliveries?poId=" + poId;
        }
        if (id != null) {
            return idIsPoId ? "/deliveries?poId=" + id : "/deliveries?id=" + id;
        }
        return "/deliveries";
    }

    private static String resolveVendorRoute(String id, String titleLower) {
        if (id != null) {
            if (titleLower.contains("performance") || titleLower.contains("risk") || titleLower.contains("score")) {
                return "/vendors/performance?vendorId=" + id;
            }
            return "/vendors?id=" + id;
        }
        if (titleLower.contains("compliance") || titleLower.contains("report") || titleLower.contains("audit")) {
            return "/analytics";
        }
        return "/vendors";
    }
}
