package com.procurement.analyticsservice.controller;

import com.procurement.analyticsservice.infrastructure.client.ProcurementClient;
import com.procurement.analyticsservice.infrastructure.client.RFQClient;
import com.procurement.analyticsservice.infrastructure.client.VendorClient;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Mono;

import java.time.Year;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class AnalyticsController {

    private final VendorClient vendorClient;
    private final ProcurementClient procurementClient;
    private final RFQClient rfqClient;

    // ── Spend Report ──────────────────────────────────────────────────────────

    @GetMapping("/reports/spend")
    public Mono<ResponseEntity<Map<String, Object>>> getSpendReport() {
        return procurementClient.getPurchaseOrders().map(purchaseOrders -> {
            double totalSpend = purchaseOrders.stream()
                .mapToDouble(po -> toDouble(po.get("totalAmount")))
                .sum();

            // Spend by status
            Map<String, Double> spendByStatus = purchaseOrders.stream()
                .collect(Collectors.groupingBy(
                    po -> String.valueOf(po.getOrDefault("status", "Unknown")),
                    Collectors.summingDouble(po -> toDouble(po.get("totalAmount")))
                ));

            // Spend by vendor (top 10)
            Map<Object, Double> spendByVendor = purchaseOrders.stream()
                .filter(po -> po.get("vendorId") != null)
                .collect(Collectors.groupingBy(
                    po -> po.get("vendorId"),
                    Collectors.summingDouble(po -> toDouble(po.get("totalAmount")))
                ));
            List<Map<String, Object>> topVendors = spendByVendor.entrySet().stream()
                .sorted(Map.Entry.<Object, Double>comparingByValue().reversed())
                .limit(10)
                .map(e -> Map.<String, Object>of("vendorId", e.getKey(), "totalSpend", e.getValue()))
                .collect(Collectors.toList());

            // Approved vs pending
            long approvedCount = purchaseOrders.stream()
                .filter(po -> "Approved".equalsIgnoreCase(String.valueOf(po.get("status")))).count();
            long pendingCount = purchaseOrders.stream()
                .filter(po -> "Pending Approval".equalsIgnoreCase(String.valueOf(po.get("status")))).count();

            Map<String, Object> report = new LinkedHashMap<>();
            report.put("totalSpend", totalSpend);
            report.put("totalOrders", purchaseOrders.size());
            report.put("approvedOrders", approvedCount);
            report.put("pendingOrders", pendingCount);
            report.put("averageOrderValue", purchaseOrders.isEmpty() ? 0 : totalSpend / purchaseOrders.size());
            report.put("spendByStatus", spendByStatus);
            report.put("topVendorsBySpend", topVendors);
            report.put("period", String.valueOf(Year.now().getValue()));
            return ResponseEntity.ok(report);
        });
    }

    // ── Vendor Comparison ─────────────────────────────────────────────────────

    @GetMapping("/reports/vendor-comparison")
    public Mono<ResponseEntity<Map<String, Object>>> getVendorComparison(
            @RequestParam List<Long> vendorIds) {
        return Mono.zip(vendorClient.getVendors(), procurementClient.getPurchaseOrders())
            .map(tuple -> {
                List<Map<String, Object>> allVendors = tuple.getT1();
                List<Map<String, Object>> allPOs = tuple.getT2();

                // Filter to requested vendors
                Set<String> requestedIds = vendorIds.stream()
                    .map(String::valueOf).collect(Collectors.toSet());
                List<Map<String, Object>> filtered = allVendors.stream()
                    .filter(v -> requestedIds.contains(String.valueOf(v.get("vendorId")))
                              || requestedIds.contains(String.valueOf(v.get("id"))))
                    .collect(Collectors.toList());

                // Per-vendor PO stats
                List<Map<String, Object>> vendorStats = filtered.stream().map(v -> {
                    Object vid = v.getOrDefault("vendorId", v.get("id"));
                    List<Map<String, Object>> vendorPOs = allPOs.stream()
                        .filter(po -> String.valueOf(vid).equals(String.valueOf(po.get("vendorId"))))
                        .collect(Collectors.toList());
                    double totalSpend = vendorPOs.stream()
                        .mapToDouble(po -> toDouble(po.get("totalAmount"))).sum();
                    long approvedPOs = vendorPOs.stream()
                        .filter(po -> "Approved".equalsIgnoreCase(String.valueOf(po.get("status")))).count();

                    Map<String, Object> stat = new LinkedHashMap<>();
                    stat.put("vendorId", vid);
                    stat.put("companyName", v.get("companyName"));
                    stat.put("status", v.get("status"));
                    stat.put("verified", v.get("verified"));
                    stat.put("category", v.getOrDefault("categoryName", v.get("category")));
                    stat.put("totalOrders", vendorPOs.size());
                    stat.put("approvedOrders", approvedPOs);
                    stat.put("totalSpend", totalSpend);
                    return stat;
                }).collect(Collectors.toList());

                long activeCount = filtered.stream()
                    .filter(v -> "ACTIVE".equals(v.get("status"))).count();
                long verifiedCount = filtered.stream()
                    .filter(v -> Boolean.TRUE.equals(v.get("verified"))).count();

                Map<String, Object> comparison = new LinkedHashMap<>();
                comparison.put("requestedVendors", vendorIds.size());
                comparison.put("foundVendors", filtered.size());
                comparison.put("activeVendors", activeCount);
                comparison.put("verifiedVendors", verifiedCount);
                comparison.put("vendors", vendorStats);
                return ResponseEntity.ok(comparison);
            });
    }

    // ── Compliance Report ─────────────────────────────────────────────────────

    @GetMapping("/reports/compliance")
    public Mono<ResponseEntity<Map<String, Object>>> getComplianceReport() {
        return vendorClient.getVendors().map(vendors -> {
            long total = vendors.size();
            long verified = vendors.stream()
                .filter(v -> Boolean.TRUE.equals(v.get("verified"))).count();
            long pending = vendors.stream()
                .filter(v -> "PENDING".equalsIgnoreCase(String.valueOf(v.get("status")))).count();
            long inactive = vendors.stream()
                .filter(v -> "INACTIVE".equalsIgnoreCase(String.valueOf(v.get("status")))).count();

            double complianceRate = total == 0 ? 0 : (verified * 100.0 / total);

            // Vendors at risk (not verified and have been registered — pending review)
            List<Map<String, Object>> atRisk = vendors.stream()
                .filter(v -> !Boolean.TRUE.equals(v.get("verified")))
                .map(v -> Map.<String, Object>of(
                    "vendorId", v.getOrDefault("vendorId", v.get("id")),
                    "companyName", v.getOrDefault("companyName", "Unknown"),
                    "status", v.getOrDefault("status", "Unknown"),
                    "complianceStatus", v.getOrDefault("complianceStatus", "Pending")
                ))
                .collect(Collectors.toList());

            // Category breakdown
            Map<String, Long> byCategory = vendors.stream()
                .collect(Collectors.groupingBy(
                    v -> String.valueOf(v.getOrDefault("categoryName",
                         v.getOrDefault("category", "Uncategorized"))),
                    Collectors.counting()
                ));

            Map<String, Object> report = new LinkedHashMap<>();
            report.put("totalVendors", total);
            report.put("verifiedVendors", verified);
            report.put("pendingVerification", pending);
            report.put("inactiveVendors", inactive);
            report.put("complianceRate", Math.round(complianceRate * 10.0) / 10.0);
            report.put("vendorsAtRisk", atRisk);
            report.put("vendorsByCategory", byCategory);
            return ResponseEntity.ok(report);
        });
    }

    // ── Dashboard Overview ────────────────────────────────────────────────────

    @GetMapping("/dashboard/overview")
    public Mono<ResponseEntity<Map<String, Object>>> getDashboardOverview() {
        return Mono.zip(
            vendorClient.getVendors(),
            rfqClient.getRFQs(),
            procurementClient.getPurchaseOrders()
        ).map(tuple -> {
            List<Map<String, Object>> vendors = tuple.getT1();
            List<Map<String, Object>> rfqs = tuple.getT2();
            List<Map<String, Object>> pos = tuple.getT3();

            // RFQ stats
            long openRFQs = rfqs.stream()
                .filter(r -> "Open".equalsIgnoreCase(String.valueOf(r.get("status")))).count();
            long closedRFQs = rfqs.stream()
                .filter(r -> "Closed".equalsIgnoreCase(String.valueOf(r.get("status")))).count();
            long awardedRFQs = rfqs.stream()
                .filter(r -> "Awarded".equalsIgnoreCase(String.valueOf(r.get("status")))).count();

            // PO stats
            long pendingApprovals = pos.stream()
                .filter(po -> "Pending Approval".equalsIgnoreCase(String.valueOf(po.get("status")))).count();
            long approvedPOs = pos.stream()
                .filter(po -> "Approved".equalsIgnoreCase(String.valueOf(po.get("status")))).count();
            double totalSpend = pos.stream()
                .filter(po -> "Approved".equalsIgnoreCase(String.valueOf(po.get("status"))))
                .mapToDouble(po -> toDouble(po.get("totalAmount"))).sum();

            // Vendor stats
            long activeVendors = vendors.stream()
                .filter(v -> "ACTIVE".equalsIgnoreCase(String.valueOf(v.get("status")))).count();
            long verifiedVendors = vendors.stream()
                .filter(v -> Boolean.TRUE.equals(v.get("verified"))).count();

            Map<String, Object> overview = new LinkedHashMap<>();
            overview.put("totalRFQs", rfqs.size());
            overview.put("openRFQs", openRFQs);
            overview.put("closedRFQs", closedRFQs);
            overview.put("awardedRFQs", awardedRFQs);
            overview.put("totalPOs", pos.size());
            overview.put("approvedPOs", approvedPOs);
            overview.put("pendingApprovals", pendingApprovals);
            overview.put("totalApprovedSpend", totalSpend);
            overview.put("vendorCount", vendors.size());
            overview.put("activeVendors", activeVendors);
            overview.put("verifiedVendors", verifiedVendors);
            return ResponseEntity.ok(overview);
        });
    }

    // ── Activity Feed ─────────────────────────────────────────────────────────

    @GetMapping("/analytics/activity")
    public Mono<ResponseEntity<Map<String, Object>>> getActivity(@RequestParam Long userId) {
        return Mono.zip(
            rfqClient.getRFQs(),
            procurementClient.getPurchaseOrders(),
            vendorClient.getVendors()
        ).map(tuple -> {
            List<Map<String, Object>> rfqs = tuple.getT1();
            List<Map<String, Object>> pos = tuple.getT2();
            List<Map<String, Object>> vendors = tuple.getT3();

            // Filter RFQs created by this user
            List<Map<String, Object>> myRFQs = rfqs.stream()
                .filter(r -> String.valueOf(userId).equals(String.valueOf(r.get("createdBy"))))
                .sorted(Comparator.comparing(r -> String.valueOf(r.getOrDefault("createdAt", "")),
                    Comparator.reverseOrder()))
                .limit(10)
                .collect(Collectors.toList());

            // Filter POs created by this user
            List<Map<String, Object>> myPOs = pos.stream()
                .filter(po -> String.valueOf(userId).equals(String.valueOf(po.get("createdBy"))))
                .sorted(Comparator.comparing(po -> String.valueOf(po.getOrDefault("createdAt", "")),
                    Comparator.reverseOrder()))
                .limit(10)
                .collect(Collectors.toList());

            // Recent vendors (last 5 registered — visible to all roles)
            List<Map<String, Object>> recentVendors = vendors.stream()
                .limit(5)
                .collect(Collectors.toList());

            Map<String, Object> activity = new LinkedHashMap<>();
            activity.put("userId", userId);
            activity.put("myRFQs", myRFQs);
            activity.put("myPOs", myPOs);
            activity.put("recentVendors", recentVendors);
            activity.put("myRFQCount", myRFQs.size());
            activity.put("myPOCount", myPOs.size());
            return ResponseEntity.ok(activity);
        });
    }

    // ── Helper ────────────────────────────────────────────────────────────────

    private double toDouble(Object value) {
        if (value == null) return 0.0;
        if (value instanceof Number n) return n.doubleValue();
        try { return Double.parseDouble(value.toString()); } catch (NumberFormatException e) { return 0.0; }
    }
}
