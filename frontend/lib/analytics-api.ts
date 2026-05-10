// Analytics API functions to fetch real data
import { analyticsApi, rfqApi, poApi, vendorApi } from "./api";

interface DashboardData {
  totalRFQs?: number;
  openRFQs?: number;
  totalPOs?: number;
  pendingApprovals?: any[];
  vendorCount?: number;
}

export async function fetchDashboardStats() {
  try {
    const [rfqs, pos, vendors, dashboard] = await Promise.all([
      rfqApi.getAllList().catch(() => []),
      poApi.getAllList().catch(() => []),
      vendorApi.getAllList().catch(() => []),
      analyticsApi.getDashboard().catch((): DashboardData | null => null),
    ]);

    const pendingApprovals = pos.filter((po: any) => po.status === "PENDING");
    const dash: DashboardData = dashboard || {};

    return {
      totalRFQs: dash.totalRFQs ?? rfqs.length,
      openRFQs: dash.openRFQs ?? rfqs.filter((r: any) => r.status === "OPEN").length,
      totalPOs: dash.totalPOs ?? pos.length,
      pendingApprovals,
      pendingCount: (dash.pendingApprovals?.length ?? pendingApprovals.length) || 0,
      vendorCount: dash.vendorCount ?? vendors.length,
      rfqs,
      pos,
      vendors,
    };
  } catch (error) {
    console.error("Failed to fetch dashboard stats:", error);
    return {
      totalRFQs: 0,
      openRFQs: 0,
      totalPOs: 0,
      pendingApprovals: [],
      pendingCount: 0,
      vendorCount: 0,
      rfqs: [],
      pos: [],
      vendors: [],
    };
  }
}
