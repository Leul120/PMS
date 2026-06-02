/** Mirrors procurement-service approval.threshold.manager / director defaults. */

export const PO_MANAGER_THRESHOLD = 10_000;
export const PO_DIRECTOR_THRESHOLD = 50_000;

export type PoApprovalTier = "auto" | "manager" | "director";

export function getPoApprovalTier(amount: number): PoApprovalTier {
  const amt = Number(amount) || 0;
  if (amt < PO_MANAGER_THRESHOLD) return "auto";
  if (amt < PO_DIRECTOR_THRESHOLD) return "manager";
  return "director";
}

/** Shown on pending POs so approvers know who must act. */
export function getPoApprovalHint(amount: number): string | null {
  const tier = getPoApprovalTier(amount);
  if (tier === "auto") return "Auto-approved on create (under $10,000)";
  if (tier === "manager") return "Requires Manager approval ($10k–$49,999)";
  return "Requires Director approval ($50,000+)";
}

export function canRoleApprovePo(amount: number, role: string | undefined): boolean {
  if (!role) return false;
  const r = role.toUpperCase();
  if (r === "ADMIN" || r === "SUPER_ADMIN") return true;
  const tier = getPoApprovalTier(amount);
  if (tier === "auto") return true;
  if (tier === "manager") return r === "MANAGER";
  if (tier === "director") return r === "DIRECTOR";
  return false;
}
