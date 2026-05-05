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
public class ProcurementClient {

    private final WebClient procurementWebClient;

    @CircuitBreaker(name = "procurementService", fallbackMethod = "getPurchaseOrdersFallback")
    @Retry(name = "procurementService")
    public Mono<List<Map<String, Object>>> getPurchaseOrders() {
        return procurementWebClient.get()
                .uri("/api/purchase-orders")
                .retrieve()
                .bodyToMono(new ParameterizedTypeReference<List<Map<String, Object>>>() {})
                .doOnError(e -> log.error("Error fetching purchase orders: {}", e.getMessage()));
    }

    @CircuitBreaker(name = "procurementService", fallbackMethod = "getPurchaseOrderByIdFallback")
    @Retry(name = "procurementService")
    public Mono<Map<String, Object>> getPurchaseOrderById(Long poId) {
        return procurementWebClient.get()
                .uri("/api/purchase-orders/{id}", poId)
                .retrieve()
                .bodyToMono(new ParameterizedTypeReference<Map<String, Object>>() {})
                .doOnError(e -> log.error("Error fetching purchase order {}: {}", poId, e.getMessage()));
    }

    // Fallback methods
    public Mono<List<Map<String, Object>>> getPurchaseOrdersFallback(Throwable t) {
        log.warn("Procurement service fallback triggered: {}", t.getMessage());
        return Mono.just(List.of());
    }

    public Mono<Map<String, Object>> getPurchaseOrderByIdFallback(Long poId, Throwable t) {
        log.warn("Procurement service fallback for id {}: {}", poId, t.getMessage());
        return Mono.just(Map.of());
    }
}
