package com.procurement.rfqbiddingservice.infrastructure.client;

import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import io.github.resilience4j.retry.annotation.Retry;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
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

    // Fallback methods
    public Map<String, Object> getVendorByIdFallback(Long vendorId, Throwable t) {
        log.warn("Vendor service fallback for id {}: {}", vendorId, t.getMessage());
        return Map.of();
    }

    public List<Map<String, Object>> getVendorsByIdsFallback(List<Long> vendorIds, Throwable t) {
        log.warn("Vendor service fallback for batch: {}", t.getMessage());
        return List.of();
    }

    public Boolean verifyVendorFallback(Long vendorId, Throwable t) {
        log.warn("Vendor verification fallback for id {}: {}", vendorId, t.getMessage());
        return false;
    }
}
