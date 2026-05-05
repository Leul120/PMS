package com.procurement.analyticsservice.controller;

import com.procurement.analyticsservice.infrastructure.client.ProcurementClient;
import com.procurement.analyticsservice.infrastructure.client.RFQClient;
import com.procurement.analyticsservice.infrastructure.client.VendorClient;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Mono;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class AnalyticsController {

    private final VendorClient vendorClient;
    private final ProcurementClient procurementClient;
    private final RFQClient rfqClient;

    @GetMapping("/reports/spend")
    public Mono<ResponseEntity<Map<String, Object>>> getSpendReport() {
        return procurementClient.getPurchaseOrders()
                .map(purchaseOrders -> {
                    double totalSpend = purchaseOrders.stream()
                            .mapToDouble(po -> ((Number) po.getOrDefault("totalAmount", 0)).doubleValue())
                            .sum();

                    Map<String, Object> report = new HashMap<>();
                    report.put("totalSpend", totalSpend);
                    report.put("period", "2024");
                    report.put("breakdown", purchaseOrders);
                    return ResponseEntity.ok(report);
                });
    }

    @GetMapping("/reports/vendor-comparison")
    public Mono<ResponseEntity<Map<String, Object>>> getVendorComparison(@RequestParam List<Long> vendorIds) {
        return vendorClient.getVendors()
                .map(vendors -> {
                    Map<String, Object> comparison = new HashMap<>();
                    comparison.put("vendors", vendorIds);
                    comparison.put("metrics", Map.of(
                            "totalVendors", vendors.size(),
                            "activeVendors", vendors.stream()
                                    .filter(v -> "ACTIVE".equals(v.get("status"))).count()
                    ));
                    return ResponseEntity.ok(comparison);
                });
    }

    @GetMapping("/reports/compliance")
    public Mono<ResponseEntity<Map<String, Object>>> getComplianceReport() {
        return vendorClient.getVendors()
                .map(vendors -> {
                    long verifiedVendors = vendors.stream()
                            .filter(v -> Boolean.TRUE.equals(v.get("verified")))
                            .count();
                    double complianceRate = vendors.isEmpty() ? 0 : (verifiedVendors * 100.0 / vendors.size());

                    Map<String, Object> report = new HashMap<>();
                    report.put("complianceRate", complianceRate);
                    report.put("issues", List.of());
                    return ResponseEntity.ok(report);
                });
    }

    @GetMapping("/dashboard/overview")
    public Mono<ResponseEntity<Map<String, Object>>> getDashboardOverview() {
        // Fetch data from all services in parallel
        return Mono.zip(
                        vendorClient.getVendors(),
                        rfqClient.getRFQs(),
                        procurementClient.getPurchaseOrders()
                )
                .map(tuple -> {
                    List<Map<String, Object>> vendors = tuple.getT1();
                    List<Map<String, Object>> rfqs = tuple.getT2();
                    List<Map<String, Object>> purchaseOrders = tuple.getT3();

                    long pendingApprovals = purchaseOrders.stream()
                            .filter(po -> "PENDING".equals(po.get("status")))
                            .count();

                    Map<String, Object> overview = new HashMap<>();
                    overview.put("totalRFQs", rfqs.size());
                    overview.put("openRFQs", rfqs.stream()
                            .filter(rfq -> "OPEN".equals(rfq.get("status")))
                            .count());
                    overview.put("totalPOs", purchaseOrders.size());
                    overview.put("pendingApprovals", pendingApprovals);
                    overview.put("vendorCount", vendors.size());
                    return ResponseEntity.ok(overview);
                });
    }
}
