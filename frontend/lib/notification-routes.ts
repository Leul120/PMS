export interface NotificationLinkSource {
  actionUrl?: string | null;
  category?: string | null;
  relatedEntityId?: string | null;
  title?: string | null;
}

/** Resolve the in-app route for a notification (stored actionUrl or category-based fallback). */
export function resolveNotificationRoute(n: NotificationLinkSource): string | null {
  if (n.actionUrl?.trim()) {
    return n.actionUrl.startsWith("/") ? n.actionUrl : `/${n.actionUrl}`;
  }

  const category = (n.category || "").toUpperCase();
  const id = n.relatedEntityId?.trim() || null;
  const titleLower = (n.title || "").toLowerCase();

  switch (category) {
    case "BID_DEADLINE":
    case "RFQ":
    case "BID":
      return id ? `/rfq?id=${id}` : "/rfq";
    case "APPROVAL_PENDING":
    case "PURCHASE_ORDER":
      if (!id) {
        return titleLower.includes("requisition") || titleLower.includes("pr-")
          ? "/requisitions"
          : "/procurement";
      }
      if (titleLower.includes("requisition") || titleLower.includes("pr-")) {
        return `/requisitions?id=${id}`;
      }
      if (titleLower.includes("report") || titleLower.includes("spend") || titleLower.includes("analytics")) {
        return "/analytics";
      }
      return `/procurement?id=${id}`;
    case "DELIVERY":
    case "DELIVERY_UPDATE":
      return id ? `/deliveries?poId=${id}` : "/deliveries";
    case "INVOICE":
      return id ? `/invoices?id=${id}` : "/invoices";
    case "DISPUTE":
      return id ? `/invoices?disputeId=${id}` : "/invoices";
    case "INVENTORY":
      return id ? `/inventory?id=${id}` : "/inventory";
    case "VENDOR_ALERT":
    case "VENDOR_MANAGEMENT":
    case "COMPLIANCE":
      if (id) {
        if (titleLower.includes("performance") || titleLower.includes("risk") || titleLower.includes("score")) {
          return `/vendors/performance?vendorId=${id}`;
        }
        return `/vendors?id=${id}`;
      }
      if (titleLower.includes("compliance") || titleLower.includes("report") || titleLower.includes("audit")) {
        return "/analytics";
      }
      return "/vendors";
    default:
      return null;
  }
}

export function isNotificationUnread(status?: string | null): boolean {
  const s = (status || "").toUpperCase();
  return s === "PENDING" || s === "SENT";
}
