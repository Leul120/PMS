export type OperatingContext = "PROCUREMENT" | "SALES";

export type OrganizationType = "BUYER" | "SUPPLIER" | "BOTH";

export const CONTEXT_LABELS: Record<OperatingContext, string> = {
  PROCUREMENT: "Procurement",
  SALES: "Sales",
};

export function canSwitchContext(
  organizationType?: string | null,
  availableContexts?: string[] | null,
): boolean {
  return (
    organizationType === "BOTH" &&
    !!availableContexts &&
    availableContexts.length > 1
  );
}
