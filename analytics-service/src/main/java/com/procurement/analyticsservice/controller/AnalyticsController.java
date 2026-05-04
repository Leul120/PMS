package com.procurement.analyticsservice.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.reactive.function.client.WebClient;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class AnalyticsController {
    
    private final WebClient.Builder webClientBuilder;
    
    // Service URLs - in production, use service discovery
    private static final String VENDOR_SERVICE_URL = "http://vendor-service:8082";
    private static final String PROCUREMENT_SERVICE_URL = "http://procurement-service:8084";
    private static final String RFQ_SERVICE_URL = "http://rfq-bidding-service:8083";
    
    @GetMapping("/reports/spend")
    public ResponseEntity<Map<String, Object>> getSpendReport() {
        // Get real PO data and calculate spend
        List<Map<String, Object>> purchaseOrders = fetchPurchaseOrders();
        double totalSpend = purchaseOrders.stream()
            .mapToDouble(po -> ((Number) po.getOrDefault("totalAmount", 0)).doubleValue())
            .sum();
        
        Map<String, Object> report = new HashMap<>();
        report.put("totalSpend", totalSpend);
        report.put("period", "2024");
        report.put("breakdown", purchaseOrders);
        return ResponseEntity.ok(report);
    }
    
    @GetMapping("/reports/vendor-comparison")
    public ResponseEntity<Map<String, Object>> getVendorComparison(@RequestParam List<Long> vendorIds) {
        List<Map<String, Object>> vendors = fetchVendors();
        
        Map<String, Object> comparison = new HashMap<>();
        comparison.put("vendors", vendorIds);
        comparison.put("metrics", Map.of(
            "totalVendors", vendors.size(),
            "activeVendors", vendors.stream().filter(v -> "ACTIVE".equals(v.get("status"))).count()
        ));
        return ResponseEntity.ok(comparison);
    }
    
    @GetMapping("/reports/compliance")
    public ResponseEntity<Map<String, Object>> getComplianceReport() {
        List<Map<String, Object>> vendors = fetchVendors();
        long verifiedVendors = vendors.stream()
            .filter(v -> Boolean.TRUE.equals(v.get("verified")))
            .count();
        double complianceRate = vendors.isEmpty() ? 0 : (verifiedVendors * 100.0 / vendors.size());
        
        Map<String, Object> report = new HashMap<>();
        report.put("complianceRate", complianceRate);
        report.put("issues", List.of());
        return ResponseEntity.ok(report);
    }
    
    @GetMapping("/dashboard/overview")
    public ResponseEntity<Map<String, Object>> getDashboardOverview() {
        // Fetch data from all services
        List<Map<String, Object>> vendors = fetchVendors();
        List<Map<String, Object>> rfqs = fetchRFQs();
        List<Map<String, Object>> purchaseOrders = fetchPurchaseOrders();
        
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
    }
    
    private List<Map<String, Object>> fetchVendors() {
        try {
            return webClientBuilder.build()
                .get()
                .uri(VENDOR_SERVICE_URL + "/api/vendors")
                .retrieve()
                .bodyToMono(new ParameterizedTypeReference<List<Map<String, Object>>>() {})
                .block();
        } catch (Exception e) {
            return List.of();
        }
    }
    
    private List<Map<String, Object>> fetchRFQs() {
        try {
            return webClientBuilder.build()
                .get()
                .uri(RFQ_SERVICE_URL + "/api/rfqs")
                .retrieve()
                .bodyToMono(new ParameterizedTypeReference<List<Map<String, Object>>>() {})
                .block();
        } catch (Exception e) {
            return List.of();
        }
    }
    
    private List<Map<String, Object>> fetchPurchaseOrders() {
        try {
            return webClientBuilder.build()
                .get()
                .uri(PROCUREMENT_SERVICE_URL + "/api/purchase-orders")
                .retrieve()
                .bodyToMono(new ParameterizedTypeReference<List<Map<String, Object>>>() {})
                .block();
        } catch (Exception e) {
            return List.of();
        }
    }
}
