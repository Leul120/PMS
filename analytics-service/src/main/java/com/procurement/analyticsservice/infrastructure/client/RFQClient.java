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
public class RFQClient {

    private final WebClient rfqWebClient;

    @CircuitBreaker(name = "rfqService", fallbackMethod = "getRFQsFallback")
    @Retry(name = "rfqService")
    public Mono<List<Map<String, Object>>> getRFQs() {
        return rfqWebClient.get()
                .uri("/api/rfqs?page=0&size=1000")
                .retrieve()
                .bodyToMono(new ParameterizedTypeReference<Map<String, Object>>() {})
                .map(body -> {
                    Object content = body.get("content");
                    if (content instanceof List<?> list) {
                        @SuppressWarnings("unchecked")
                        List<Map<String, Object>> typed = (List<Map<String, Object>>) list;
                        return typed;
                    }
                    return List.<Map<String, Object>>of();
                })
                .doOnError(e -> log.error("Error fetching RFQs: {}", e.getMessage()));
    }

    @CircuitBreaker(name = "rfqService", fallbackMethod = "getRFQByIdFallback")
    @Retry(name = "rfqService")
    public Mono<Map<String, Object>> getRFQById(Long rfqId) {
        return rfqWebClient.get()
                .uri("/api/rfqs/{id}", rfqId)
                .retrieve()
                .bodyToMono(new ParameterizedTypeReference<Map<String, Object>>() {})
                .doOnError(e -> log.error("Error fetching RFQ {}: {}", rfqId, e.getMessage()));
    }

    // Fallback methods
    public Mono<List<Map<String, Object>>> getRFQsFallback(Throwable t) {
        log.warn("RFQ service fallback triggered: {}", t.getMessage());
        return Mono.just(List.of());
    }

    public Mono<Map<String, Object>> getRFQByIdFallback(Long rfqId, Throwable t) {
        log.warn("RFQ service fallback for id {}: {}", rfqId, t.getMessage());
        return Mono.just(Map.of());
    }
}
