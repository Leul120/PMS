/** Human-friendly reference labels — not raw database IDs. */

export function formatPoRef(id: string | number | null | undefined, poNumber?: string | null): string {
  if (poNumber?.trim()) return poNumber.trim();
  if (id == null || id === "") return "—";
  return `PO-${String(id).padStart(6, "0")}`;
}

export function formatRfqRef(id: string | number | null | undefined, rfqNumber?: string | null): string {
  if (rfqNumber?.trim()) return rfqNumber.trim();
  if (id == null || id === "") return "—";
  return `RFQ-${String(id).padStart(6, "0")}`;
}

export function formatReqRef(id: string | number | null | undefined, requisitionNumber?: string | null): string {
  if (requisitionNumber?.trim()) return requisitionNumber.trim();
  if (id == null || id === "") return "—";
  return `REQ-${String(id).padStart(6, "0")}`;
}

export function formatInvRef(id: string | number | null | undefined, invoiceNumber?: string | null): string {
  if (invoiceNumber?.trim()) return invoiceNumber.trim();
  if (id == null || id === "") return "—";
  return `INV-${String(id).padStart(6, "0")}`;
}

export function formatDelRef(id: string | number | null | undefined): string {
  if (id == null || id === "") return "—";
  return `DEL-${String(id).padStart(6, "0")}`;
}

/** Resolve vendor for display — never shows "Vendor #123". */
export function displayVendorName(
  vendorId: string | number | null | undefined,
  options?: {
    name?: string | null;
    map?: Map<string, string>;
    empty?: string;
    unknown?: string;
  }
): string {
  const empty = options?.empty ?? "—";
  const unknown = options?.unknown ?? "Unknown vendor";
  const direct = options?.name?.trim();
  if (direct) return direct;
  if (vendorId == null || vendorId === "") return empty;
  const fromMap = options?.map?.get(String(vendorId));
  if (fromMap) return fromMap;
  return unknown;
}

/** Resolve user for audit logs and activity — never shows "User #123". */
export function displayUserName(
  userId: string | number | null | undefined,
  options?: {
    fullName?: string | null;
    email?: string | null;
    map?: Map<string, string>;
    system?: string;
    unknown?: string;
  }
): string {
  const system = options?.system ?? "System";
  const unknown = options?.unknown ?? "Unknown user";
  if (userId == null || userId === "") return system;
  const direct = options?.fullName?.trim() || options?.email?.trim();
  if (direct) return direct;
  const fromMap = options?.map?.get(String(userId));
  if (fromMap) return fromMap;
  return unknown;
}

/** Resolve category — never shows "Category #5". */
export function displayCategoryName(
  raw: string | number | null | undefined,
  options?: {
    map?: Map<string, string>;
    fallback?: string;
  }
): string {
  const fallback = options?.fallback ?? "Uncategorized";
  if (raw == null || raw === "") return fallback;
  const str = String(raw).trim();
  if (!str) return fallback;
  if (!/^\d+$/.test(str)) return str;
  return options?.map?.get(str) ?? fallback;
}

/** Resolve tenant / organisation name. */
export function displayTenantName(
  tenantId: string | number | null | undefined,
  options?: {
    name?: string | null;
    domain?: string | null;
    map?: Map<string, string>;
    fallback?: string;
  }
): string {
  const fallback = options?.fallback ?? "Unknown organisation";
  const direct = options?.name?.trim() || options?.domain?.trim();
  if (direct) return direct;
  if (tenantId != null && tenantId !== "") {
    const fromMap = options?.map?.get(String(tenantId));
    if (fromMap) return fromMap;
  }
  return fallback;
}
