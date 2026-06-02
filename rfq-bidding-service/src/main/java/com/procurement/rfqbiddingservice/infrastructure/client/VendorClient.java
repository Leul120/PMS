package com.procurement.rfqbiddingservice.infrastructure.client;

import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import io.github.resilience4j.retry.annotation.Retry;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;

import java.util.List;
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

    @CircuitBreaker(name = "vendorService", fallbackMethod = "getVendorsByIdsFallback")
    @Retry(name = "vendorService")
    public List<Map<String, Object>> getVendorsByIds(List<Long> vendorIds) {
        return vendorWebClient.post()
                .uri("/api/vendors/batch")
                .bodyValue(vendorIds)
                .retrieve()
                .bodyToMono(new ParameterizedTypeReference<List<Map<String, Object>>>() {})
                .doOnError(e -> log.error("Error fetching vendors: {}", e.getMessage()))
                .block();
    }

    @CircuitBreaker(name = "vendorService", fallbackMethod = "verifyVendorFallback")
    @Retry(name = "vendorService")
    public Boolean verifyVendor(Long vendorId) {
        return vendorWebClient.get()
                .uri("/api/vendors/{id}/verify", vendorId)
                .retrieve()
                .bodyToMono(Boolean.class)
                .doOnError(e -> log.error("Error verifying vendor {}: {}", vendorId, e.getMessage()))
                .block();
    }

    /** Returns the company name for a vendor, or a safe fallback if the service is unavailable. */
    @Cacheable(value = "vendorNames", key = "#vendorId",
               unless = "#result == null || #result.startsWith('Vendor #')")
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

    @CircuitBreaker(name = "vendorService", fallbackMethod = "getVendorByUserIdFallback")
    @Retry(name = "vendorService")
    public Map<String, Object> getVendorByUserId(Long userId) {
        return vendorWebClient.get()
                .uri("/api/vendors/user/{userId}", userId)
                .retrieve()
                .bodyToMono(new ParameterizedTypeReference<Map<String, Object>>() {})
                .doOnError(e -> log.error("Error fetching vendor for userId {}: {}", userId, e.getMessage()))
                .block();
    }

    @CircuitBreaker(name = "vendorService", fallbackMethod = "getVendorIdsByTenantIdFallback")
    @Retry(name = "vendorService")
    public List<Long> getVendorIdsByTenantId(Long tenantId) {
        return vendorWebClient.get()
                .uri("/api/vendors/by-tenant/{tenantId}/ids", tenantId)
                .retrieve()
                .bodyToMono(new ParameterizedTypeReference<List<Long>>() {})
                .doOnError(e -> log.error("Error fetching vendor IDs for tenant {}: {}", tenantId, e.getMessage()))
                .block();
    }

    // Fallback methods
    public Map<String, Object> getVendorByIdFallback(Long vendorId, Throwable t) {
        log.warn("Vendor service fallback for id {}: {}", vendorId, t.getMessage());
        return Map.of("companyName", "Vendor #" + vendorId);
    }

    public List<Map<String, Object>> getVendorsByIdsFallback(List<Long> vendorIds, Throwable t) {
        log.warn("Vendor service fallback for batch: {}", t.getMessage());
        return List.of();
    }

    public Boolean verifyVendorFallback(Long vendorId, Throwable t) {
        log.warn("Vendor verification fallback for id {}: {}", vendorId, t.getMessage());
        return false;
    }

    public Map<String, Object> getVendorByUserIdFallback(Long userId, Throwable t) {
        log.warn("Vendor by userId fallback for userId {}: {}", userId, t.getMessage());
        return null;
    }

    public List<Long> getVendorIdsByTenantIdFallback(Long tenantId, Throwable t) {
        log.warn("Vendor IDs by tenant fallback for tenantId {}: {}", tenantId, t.getMessage());
        return List.of();
    }
}
