package com.procurement.rfqbiddingservice.infrastructure.client;

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
public class ScoringClient {

    private final WebClient scoringWebClient;

    @CircuitBreaker(name = "scoringService", fallbackMethod = "getVendorPerformanceFallback")
    @Retry(name = "scoringService")
    public Map<String, Object> getVendorPerformance(Long vendorId) {
        return scoringWebClient.get()
                .uri("/api/scores/vendor/{vendorId}/performance", vendorId)
                .retrieve()
                .bodyToMono(new ParameterizedTypeReference<Map<String, Object>>() {})
                .doOnError(e -> log.error("Error fetching performance for vendor {}: {}", vendorId, e.getMessage()))
                .block();
    }

    public Map<String, Object> getVendorPerformanceFallback(Long vendorId, Throwable t) {
        log.warn("Scoring service fallback for vendor {}: {}", vendorId, t.getMessage());
        return Map.of();
    }
}
