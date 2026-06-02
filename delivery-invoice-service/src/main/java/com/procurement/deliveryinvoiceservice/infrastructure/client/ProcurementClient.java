package com.procurement.deliveryinvoiceservice.infrastructure.client;

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
public class ProcurementClient {

    private final WebClient procurementWebClient;

    @CircuitBreaker(name = "procurementService", fallbackMethod = "getPurchaseOrderByIdFallback")
    @Retry(name = "procurementService")
    public Map<String, Object> getPurchaseOrderById(Long poId) {
        return procurementWebClient.get()
                .uri("/api/purchase-orders/{id}", poId)
                .retrieve()
                .bodyToMono(new ParameterizedTypeReference<Map<String, Object>>() {})
                .doOnError(e -> log.error("Error fetching PO {}: {}", poId, e.getMessage()))
                .block();
    }

    @CircuitBreaker(name = "procurementService", fallbackMethod = "updatePOStatusFallback")
    @Retry(name = "procurementService")
    public Map<String, Object> updatePOStatus(Long poId, String status) {
        return procurementWebClient.put()
                .uri("/api/purchase-orders/{id}/status?status={status}", poId, status)
                .retrieve()
                .bodyToMono(new ParameterizedTypeReference<Map<String, Object>>() {})
                .doOnError(e -> log.error("Error updating PO {} status: {}", poId, e.getMessage()))
                .block();
    }

    // Fallback methods
    public Map<String, Object> getPurchaseOrderByIdFallback(Long poId, Throwable t) {
        log.warn("Procurement service fallback for PO {}: {}", poId, t.getMessage());
        return Map.of();
    }

    public Map<String, Object> updatePOStatusFallback(Long poId, String status, Throwable t) {
        log.warn("Procurement service fallback for status update {}: {}", poId, t.getMessage());
        return Map.of("error", "Service unavailable");
    }
}
