"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

type Variant = "emerald" | "blue" | "amber";

const VARIANT_STYLES: Record<Variant, { box: string; text: string; link: string }> = {
  emerald: {
    box: "border-emerald-200 bg-emerald-50",
    text: "text-emerald-800",
    link: "text-emerald-700",
  },
  blue: {
    box: "border-blue-200 bg-blue-50",
    text: "text-blue-800",
    link: "text-blue-700",
  },
  amber: {
    box: "border-amber-200 bg-amber-50",
    text: "text-amber-800",
    link: "text-amber-700",
  },
};

export function WorkflowNextStep({
  message,
  href,
  linkLabel,
  variant = "emerald",
  className,
}: {
  message: string;
  href: string;
  linkLabel: string;
  variant?: Variant;
  className?: string;
}) {
  const styles = VARIANT_STYLES[variant];
  return (
    <div
      className={cn(
        "rounded-md border px-3 py-2 flex flex-wrap items-center justify-between gap-2",
        styles.box,
        className,
      )}
    >
      <p className={cn("text-[11px]", styles.text)}>{message}</p>
      <Link
        href={href}
        className={cn(
          "text-[11px] font-medium hover:underline flex items-center gap-1 shrink-0",
          styles.link,
        )}
      >
        {linkLabel}
        <ArrowRight className="h-3 w-3" aria-hidden />
      </Link>
    </div>
  );
}
