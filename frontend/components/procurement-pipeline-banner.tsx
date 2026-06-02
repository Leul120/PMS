"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { ChevronRight } from "lucide-react";

export type PipelineStep =
  | "requisition"
  | "rfq"
  | "award"
  | "po"
  | "fulfillment"
  | "delivery"
  | "invoice";

const STEPS: { id: PipelineStep; label: string; href: string }[] = [
  { id: "requisition", label: "Requisition", href: "/requisitions" },
  { id: "rfq", label: "RFQ & Bids", href: "/rfq" },
  { id: "award", label: "Award", href: "/rfq" },
  { id: "po", label: "PO Approval", href: "/procurement" },
  { id: "fulfillment", label: "Order Tracking", href: "/orders" },
  { id: "delivery", label: "Deliveries", href: "/deliveries" },
  { id: "invoice", label: "Invoices", href: "/invoices" },
];

export function ProcurementPipelineBanner({ activeStep }: { activeStep: PipelineStep }) {
  const activeIdx = STEPS.findIndex((s) => s.id === activeStep);

  return (
    <nav
      aria-label="Procurement workflow"
      className="flex flex-wrap items-center gap-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded text-[10px] text-gray-500"
    >
      <span className="font-medium text-gray-600 mr-1">Pipeline:</span>
      {STEPS.map((step, idx) => (
        <span key={step.id} className="flex items-center gap-1">
          {idx > 0 && <ChevronRight className="h-3 w-3 text-gray-300" aria-hidden />}
          <Link
            href={step.href}
            aria-current={idx === activeIdx ? "step" : undefined}
            className={cn(
              "px-1.5 py-0.5 rounded transition-colors",
              idx === activeIdx
                ? "bg-emerald-100 text-emerald-800 font-semibold"
                : idx < activeIdx
                ? "text-gray-600 hover:text-emerald-700"
                : "text-gray-400 hover:text-gray-600",
            )}
          >
            {step.label}
          </Link>
        </span>
      ))}
    </nav>
  );
}
