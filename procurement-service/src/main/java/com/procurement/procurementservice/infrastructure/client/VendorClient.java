package com.procurement.procurementservice.infrastructure.client;

import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import io.github.resilience4j.retry.annotation.Retry;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;

import java.util.Map;

@Slf4j
@Component
@RequiredArgsConstructor
public class VendorClient {

    private final WebClient vendorWebClient;

    @CircuitBreaker(name = "vendorService", fallbackMethod = "getVendorByIdFallback")
    @Retry(name = "vendorService")
    public Map<String, Object> getVendorById(Long vendorId) {
        return vendorWebClient.get()
                .uri("/api/vendors/{id}", vendorId)
                .retrieve()
                .bodyToMono(new ParameterizedTypeReference<Map<String, Object>>() {})
                .doOnError(e -> log.error("Error fetching vendor {}: {}", vendorId, e.getMessage()))
                .block();
    }

    /** Returns the company name for a vendor, or a safe fallback if the service is unavailable. */
    public String getVendorName(Long vendorId) {
        if (vendorId == null) return null;
        try {
            Map<String, Object> vendor = getVendorById(vendorId);
            if (vendor != null) {
                Object name = vendor.get("companyName");
                if (name != null) return name.toString();
            }
        } catch (Exception e) {
            log.warn("Could not resolve vendor name for id {}: {}", vendorId, e.getMessage());
        }
        return "Vendor #" + vendorId;
    }

    /**
     * Batch-resolves vendor names for a list of IDs using a single HTTP call.
     * Falls back to individual lookups if the batch endpoint fails.
     */
    @CircuitBreaker(name = "vendorService", fallbackMethod = "getVendorNamesBatchFallback")
    @Retry(name = "vendorService")
    public java.util.Map<Long, String> getVendorNamesBatch(java.util.List<Long> vendorIds) {
        if (vendorIds == null || vendorIds.isEmpty()) return java.util.Map.of();
        java.util.List<Map<String, Object>> vendors = vendorWebClient.post()
                .uri("/api/vendors/batch")
                .bodyValue(vendorIds)
                .retrieve()
                .bodyToMono(new ParameterizedTypeReference<java.util.List<Map<String, Object>>>() {})
                .doOnError(e -> log.error("Error batch-fetching vendors: {}", e.getMessage()))
                .block();
        java.util.Map<Long, String> result = new java.util.HashMap<>();
        if (vendors != null) {
            vendors.forEach(v -> {
                Object id = v.get("vendorId");
                Object name = v.get("companyName");
                if (id != null && name != null) {
                    result.put(((Number) id).longValue(), name.toString());
                }
            });
        }
        return result;
    }

    public java.util.Map<Long, String> getVendorNamesBatchFallback(java.util.List<Long> vendorIds, Throwable t) {
        log.warn("Vendor batch fallback: {}", t.getMessage());
        java.util.Map<Long, String> fallback = new java.util.HashMap<>();
        if (vendorIds != null) vendorIds.forEach(id -> fallback.put(id, "Vendor #" + id));
        return fallback;
    }

    // Fallback
    public Map<String, Object> getVendorByIdFallback(Long vendorId, Throwable t) {
        log.warn("Vendor service fallback for id {}: {}", vendorId, t.getMessage());
        return Map.of("companyName", "Vendor #" + vendorId);
    }
}
