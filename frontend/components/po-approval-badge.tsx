"use client";

import { getPoApprovalHint, getPoApprovalTier } from "@/lib/po-approval";
import { cn } from "@/lib/utils";

export function PoApprovalBadge({
  amount,
  status,
  className,
}: {
  amount: number;
  status?: string;
  className?: string;
}) {
  const s = status?.toLowerCase() || "";
  const isPending = s.includes("pending") || s === "draft";
  if (!isPending) return null;

  const hint = getPoApprovalHint(amount);
  if (!hint) return null;

  const tier = getPoApprovalTier(amount);
  const cls =
    tier === "director"
      ? "bg-violet-50 text-violet-700 border-violet-200"
      : tier === "manager"
      ? "bg-blue-50 text-blue-700 border-blue-200"
      : "bg-gray-50 text-gray-600 border-gray-200";

  return (
    <span
      className={cn(
        "inline-flex mt-0.5 max-w-[200px] px-1.5 py-0.5 rounded border text-[9px] font-medium leading-tight",
        cls,
        className,
      )}
      title={hint}
    >
      {hint}
    </span>
  );
}
