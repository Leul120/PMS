"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  type BidScoreBreakdown,
  type NormalisedBid,
  type VendorKpi,
  computeBidBreakdown,
  riskBadgeClass,
} from "@/lib/bid-scoring";

type BidComparisonPanelProps = {
  bids: NormalisedBid[];
  vendorKpis: Record<string, VendorKpi>;
  selectedBidId: string;
  onSelectBid: (bidId: string) => void;
  showVendorHistoryLink?: boolean;
};

function ScoreBar({ label, value, weight }: { label: string; value: number | null; weight: string }) {
  if (value == null) return null;
  return (
    <div className="space-y-0.5">
      <div className="flex justify-between text-[10px]">
        <span className="text-gray-500">{label} ({weight})</span>
        <span className="font-medium text-gray-800">{value}</span>
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-emerald-500 rounded-full transition-all"
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      </div>
    </div>
  );
}

export function BidComparisonPanel({
  bids,
  vendorKpis,
  selectedBidId,
  onSelectBid,
  showVendorHistoryLink = true,
}: BidComparisonPanelProps) {
  const selected = bids.find((b) => b.id === selectedBidId);
  const selectedKpi = selected ? vendorKpis[selected.vendorId] : undefined;
  const breakdown: BidScoreBreakdown | null = selected
    ? computeBidBreakdown(selected, bids, selectedKpi)
    : null;

  return (
    <div className="space-y-3">
      <div className="border border-gray-200 rounded overflow-x-auto">
        <table className="w-full text-xs min-w-[520px]">
          <thead className="bg-gray-50 text-gray-500">
            <tr>
              <th className="text-left font-medium px-2 py-1.5">#</th>
              <th className="text-left font-medium px-2 py-1.5">Vendor</th>
              <th className="text-right font-medium px-2 py-1.5">Bid</th>
              <th className="text-right font-medium px-2 py-1.5">Delivery</th>
              <th className="text-right font-medium px-2 py-1.5">Bid score</th>
              <th className="text-right font-medium px-2 py-1.5">History</th>
              <th className="text-right font-medium px-2 py-1.5">Risk</th>
            </tr>
          </thead>
          <tbody>
            {bids.map((bid, idx) => {
              const kpi = vendorKpis[bid.vendorId];
              const isSelected = bid.id === selectedBidId;
              const isTop = idx === 0 && bid.score > 0;
              return (
                <tr
                  key={bid.id}
                  className={cn(
                    "border-t border-gray-100 cursor-pointer hover:bg-gray-50",
                    isSelected && "bg-emerald-50",
                  )}
                  onClick={() => onSelectBid(bid.id)}
                >
                  <td className="px-2 py-1.5 text-gray-400">{idx + 1}</td>
                  <td className="px-2 py-1.5 font-medium text-gray-800">
                    {bid.vendorName}
                    {isTop && (
                      <span className="ml-1 text-[10px] text-emerald-600 font-normal">recommended</span>
                    )}
                  </td>
                  <td className="px-2 py-1.5 text-right">${bid.bidAmount.toLocaleString()}</td>
                  <td className="px-2 py-1.5 text-right text-gray-500">{bid.deliveryTime}</td>
                  <td className="px-2 py-1.5 text-right font-semibold">
                    {bid.score > 0 ? bid.score : "—"}
                  </td>
                  <td className="px-2 py-1.5 text-right text-gray-600">
                    {kpi?.overallScore != null ? kpi.overallScore : "—"}
                  </td>
                  <td className="px-2 py-1.5 text-right">
                    {kpi ? (
                      <span
                        className={cn(
                          "inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium",
                          riskBadgeClass(kpi.riskLevel),
                        )}
                      >
                        {kpi.riskLevel}
                      </span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {selected && breakdown && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="border border-gray-200 rounded p-3 space-y-2">
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
              Bid evaluation ({breakdown.total}/100)
            </p>
            <ScoreBar label="Timeliness" value={breakdown.timeliness} weight="35%" />
            <ScoreBar label="Quality" value={breakdown.quality} weight="35%" />
            <ScoreBar label="Cost" value={breakdown.cost} weight="20%" />
            <ScoreBar label="Responsiveness" value={breakdown.responsiveness} weight="10%" />
          </div>
          <div className="border border-gray-200 rounded p-3 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                Vendor history KPIs
              </p>
              {showVendorHistoryLink && selected.vendorId && (
                <Link
                  href={`/vendors/performance?vendorId=${selected.vendorId}`}
                  className="text-[10px] text-emerald-700 hover:underline"
                >
                  Full scorecard →
                </Link>
              )}
            </div>
            {selectedKpi ? (
              <>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Overall score</span>
                  <span className="font-semibold">{selectedKpi.overallScore ?? "—"}</span>
                </div>
                <ScoreBar label="On-time delivery" value={selectedKpi.timelinessScore} weight="hist." />
                <ScoreBar label="Quality" value={selectedKpi.qualityScore} weight="hist." />
                <ScoreBar label="Price competitiveness" value={selectedKpi.costScore} weight="hist." />
                <ScoreBar label="Responsiveness" value={selectedKpi.responsivenessScore} weight="hist." />
              </>
            ) : (
              <p className="text-[11px] text-gray-400">
                No delivery history yet — bid score uses defaults for this vendor.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
