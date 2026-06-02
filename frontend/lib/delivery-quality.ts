/** Structured delivery inspection — must match backend QualityRating / issue codes. */

export const QUALITY_RATINGS = [
  { value: "ACCEPTED", label: "Accepted — meets specification" },
  { value: "ACCEPTED_WITH_ISSUES", label: "Accepted with issues" },
  { value: "REJECTED", label: "Rejected — do not accept" },
] as const;

export type QualityRating = (typeof QUALITY_RATINGS)[number]["value"];

export const QUALITY_ISSUE_TYPES = [
  { value: "DAMAGED", label: "Damaged goods" },
  { value: "SHORT_SHIP", label: "Short shipment" },
  { value: "WRONG_ITEM", label: "Wrong item" },
  { value: "WRONG_SPEC", label: "Does not match specification" },
  { value: "PACKAGING", label: "Packaging problems" },
] as const;

export type QualityIssueType = (typeof QUALITY_ISSUE_TYPES)[number]["value"];

export function formatQualityRating(rating?: string | null): string {
  if (!rating) return "—";
  return QUALITY_RATINGS.find((r) => r.value === rating)?.label ?? rating.replace(/_/g, " ");
}

export function formatQualityIssues(issues?: string | null): string {
  if (!issues?.trim()) return "—";
  return issues
    .split(",")
    .map((code) => QUALITY_ISSUE_TYPES.find((t) => t.value === code.trim())?.label ?? code.trim())
    .join(", ");
}
