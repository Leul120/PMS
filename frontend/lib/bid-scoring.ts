import { scoringApi } from "@/lib/api";

export type VendorKpi = {
  overallScore: number | null;
  riskLevel: string;
  timelinessScore: number | null;
  qualityScore: number | null;
  costScore: number | null;
  responsivenessScore: number | null;
};

export type NormalisedBid = {
  id: string;
  bidId: string;
  vendorId: string;
  vendorName: string;
  bidAmount: number;
  deliveryDays?: number;
  deliveryTime: string;
  status?: string;
  score: number;
  qualityScore: number | null;
  proposalText?: string;
};

export type BidScoreBreakdown = {
  timeliness: number;
  quality: number | null;
  cost: number;
  responsiveness: number | null;
  total: number;
};

export function normaliseBid(b: Record<string, unknown>, vendorName?: string): NormalisedBid {
  const deliveryDays = b.deliveryDays != null ? Number(b.deliveryDays) : undefined;
  return {
    id: String(b.id || b.bidId),
    bidId: String(b.bidId || b.id),
    vendorId: String(b.vendorId),
    vendorName: String(b.vendorName || vendorName || `Vendor #${b.vendorId}`),
    bidAmount: Number(b.bidAmount) || 0,
    deliveryDays,
    deliveryTime:
      String(b.deliveryTime || "") ||
      (deliveryDays ? `${deliveryDays} days` : "—"),
    status: b.status ? String(b.status) : undefined,
    score: Number(b.score ?? (b.totalScore != null ? Math.round(Number(b.totalScore)) : 0)) || 0,
    qualityScore: b.qualityScore != null ? Math.round(Number(b.qualityScore)) : null,
    proposalText: b.proposalText ? String(b.proposalText) : undefined,
  };
}

/** Mirrors backend evaluate weights: timeliness 35%, quality 35%, cost 20%, responsiveness 10% */
export function computeBidBreakdown(
  bid: NormalisedBid,
  allBids: NormalisedBid[],
  vendorKpi?: VendorKpi | null,
): BidScoreBreakdown {
  const deliveryDays = bid.deliveryDays ?? 0;
  const timeliness = deliveryDays > 0 ? Math.max(0, 100 - deliveryDays * 2) : 100;
  const amounts = allBids.map((b) => b.bidAmount).filter((n) => n > 0);
  const lowest = amounts.length ? Math.min(...amounts) : bid.bidAmount;
  const cost =
    bid.bidAmount > 0 && lowest > 0
      ? Math.round((lowest / bid.bidAmount) * 100)
      : 0;
  const quality = bid.qualityScore ?? vendorKpi?.qualityScore ?? 80;
  const responsiveness = vendorKpi?.responsivenessScore ?? 80;
  const total = Math.round(
    timeliness * 0.35 + quality * 0.35 + cost * 0.2 + responsiveness * 0.1,
  );
  return {
    timeliness: Math.round(timeliness),
    quality: quality != null ? Math.round(quality) : null,
    cost,
    responsiveness: responsiveness != null ? Math.round(responsiveness) : null,
    total: bid.score > 0 ? bid.score : total,
  };
}

export async function loadVendorKpis(
  vendorIds: (string | number)[],
): Promise<Record<string, VendorKpi>> {
  const unique = Array.from(new Set(vendorIds.map(String)));
  const results = await Promise.all(
    unique.map(async (id) => {
      const perf = await scoringApi.getPerformance(id).catch(() => null);
      if (!perf) return [id, null] as const;
      const kpi: VendorKpi = {
        overallScore: perf.overallScore != null ? Math.round(Number(perf.overallScore)) : null,
        riskLevel: String(perf.riskLevel || "Unknown"),
        timelinessScore:
          perf.timelinessScore != null ? Math.round(Number(perf.timelinessScore)) : null,
        qualityScore:
          perf.qualityScore != null ? Math.round(Number(perf.qualityScore)) : null,
        costScore: perf.costScore != null ? Math.round(Number(perf.costScore)) : null,
        responsivenessScore:
          perf.responsivenessScore != null
            ? Math.round(Number(perf.responsivenessScore))
            : null,
      };
      return [id, kpi] as const;
    }),
  );
  return Object.fromEntries(results.filter(([, v]) => v != null)) as Record<string, VendorKpi>;
}

/** RFQ IDs that already have a non-rejected PO (one PO per RFQ rule). */
export function collectRfqIdsWithPo(pos: { rfqId?: unknown; status?: unknown }[]): Record<string, boolean> {
  const map: Record<string, boolean> = {};
  for (const po of pos) {
    const status = String(po.status ?? "").toLowerCase();
    if (status.includes("rejected")) continue;
    if (po.rfqId != null) map[String(po.rfqId)] = true;
  }
  return map;
}

export function hasPoForRfq(map: Record<string, boolean>, rfqId: string | number): boolean {
  return !!map[String(rfqId)];
}

export type RfqPoLink = { poId: string; poNumber: string; status: string };

/** Maps RFQ id → existing non-rejected PO for deep links. */
export function buildRfqPoMap(
  pos: { rfqId?: unknown; poId?: unknown; id?: unknown; poNumber?: unknown; status?: unknown }[],
): Record<string, RfqPoLink> {
  const map: Record<string, RfqPoLink> = {};
  for (const po of pos) {
    const status = String(po.status ?? "").toLowerCase();
    if (status.includes("rejected") || po.rfqId == null) continue;
    map[String(po.rfqId)] = {
      poId: String(po.poId ?? po.id),
      poNumber: String(po.poNumber || `PO-${String(po.poId ?? po.id).padStart(6, "0")}`),
      status: String(po.status ?? ""),
    };
  }
  return map;
}

export function riskBadgeClass(risk: string): string {
  const r = risk.toUpperCase();
  if (r === "LOW") return "bg-emerald-100 text-emerald-700";
  if (r === "HIGH") return "bg-red-100 text-red-700";
  if (r === "MEDIUM") return "bg-amber-100 text-amber-700";
  return "bg-gray-100 text-gray-600";
}
