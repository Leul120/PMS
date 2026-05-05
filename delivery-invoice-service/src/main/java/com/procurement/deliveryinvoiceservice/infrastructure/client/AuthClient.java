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
public class AuthClient {

    private final WebClient authWebClient;

    @CircuitBreaker(name = "authService", fallbackMethod = "getUserByIdFallback")
    @Retry(name = "authService")
    public Map<String, Object> getUserById(Long userId) {
        return authWebClient.get()
                .uri("/api/users/{id}", userId)
                .retrieve()
                .bodyToMono(new ParameterizedTypeReference<Map<String, Object>>() {})
                .doOnError(e -> log.error("Error fetching user {}: {}", userId, e.getMessage()))
                .block();
    }

    // Fallback methods
    public Map<String, Object> getUserByIdFallback(Long userId, Throwable t) {
        log.warn("Auth service fallback for user {}: {}", userId, t.getMessage());
        return Map.of("id", userId, "name", "Unknown");
    }
}
