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
public class RFQClient {

    private final WebClient rfqWebClient;

    @CircuitBreaker(name = "rfqService", fallbackMethod = "getRFQByIdFallback")
    @Retry(name = "rfqService")
    public Map<String, Object> getRFQById(Long rfqId) {
        return rfqWebClient.get()
                .uri("/api/rfqs/{id}", rfqId)
                .retrieve()
                .bodyToMono(new ParameterizedTypeReference<Map<String, Object>>() {})
                .doOnError(e -> log.error("Error fetching RFQ {}: {}", rfqId, e.getMessage()))
                .block();
    }

    @CircuitBreaker(name = "rfqService", fallbackMethod = "getWinningBidFallback")
    @Retry(name = "rfqService")
    public Map<String, Object> getWinningBid(Long rfqId) {
        return rfqWebClient.get()
                .uri("/api/rfqs/{id}/winning-bid", rfqId)
                .retrieve()
                .bodyToMono(new ParameterizedTypeReference<Map<String, Object>>() {})
                .doOnError(e -> log.error("Error fetching winning bid for RFQ {}: {}", rfqId, e.getMessage()))
                .block();
    }

    // Fallback methods
    public Map<String, Object> getRFQByIdFallback(Long rfqId, Throwable t) {
        log.warn("RFQ service fallback for id {}: {}", rfqId, t.getMessage());
        return Map.of();
    }

    public Map<String, Object> getWinningBidFallback(Long rfqId, Throwable t) {
        log.warn("RFQ service fallback for winning bid {}: {}", rfqId, t.getMessage());
        return Map.of();
    }
}
