package com.procurement.analyticsservice.infrastructure.client;

import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import io.github.resilience4j.retry.annotation.Retry;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

import java.util.List;
import java.util.Map;

@Slf4j
@Component
@RequiredArgsConstructor
public class VendorClient {

    private final WebClient vendorWebClient;

    @CircuitBreaker(name = "vendorService", fallbackMethod = "getVendorsFallback")
    @Retry(name = "vendorService")
    public Mono<List<Map<String, Object>>> getVendors() {
        return vendorWebClient.get()
                .uri("/api/vendors")
                .retrieve()
                .bodyToMono(new ParameterizedTypeReference<List<Map<String, Object>>>() {})
                .doOnError(e -> log.error("Error fetching vendors: {}", e.getMessage()));
    }

    @CircuitBreaker(name = "vendorService", fallbackMethod = "getVendorByIdFallback")
    @Retry(name = "vendorService")
    public Mono<Map<String, Object>> getVendorById(Long vendorId) {
        return vendorWebClient.get()
                .uri("/api/vendors/{id}", vendorId)
                .retrieve()
                .bodyToMono(new ParameterizedTypeReference<Map<String, Object>>() {})
                .doOnError(e -> log.error("Error fetching vendor {}: {}", vendorId, e.getMessage()));
    }

    // Fallback methods
    public Mono<List<Map<String, Object>>> getVendorsFallback(Throwable t) {
        log.warn("Vendor service fallback triggered: {}", t.getMessage());
        return Mono.just(List.of());
    }

    public Mono<Map<String, Object>> getVendorByIdFallback(Long vendorId, Throwable t) {
        log.warn("Vendor service fallback for id {}: {}", vendorId, t.getMessage());
        return Mono.just(Map.of());
    }
}
