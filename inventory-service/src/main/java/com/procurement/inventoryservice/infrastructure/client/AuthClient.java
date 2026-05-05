package com.procurement.inventoryservice.infrastructure.client;

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

    @CircuitBreaker(name = "authService", fallbackMethod = "validateTokenFallback")
    @Retry(name = "authService")
    public Map<String, Object> validateToken(String token) {
        return authWebClient.post()
                .uri("/api/auth/validate")
                .header("Authorization", token)
                .retrieve()
                .bodyToMono(new ParameterizedTypeReference<Map<String, Object>>() {})
                .doOnError(e -> log.error("Error validating token: {}", e.getMessage()))
                .block();
    }

    // Fallback method
    public Map<String, Object> validateTokenFallback(String token, Throwable t) {
        log.warn("Auth service fallback for token validation: {}", t.getMessage());
        return Map.of("valid", false, "error", "Service unavailable");
    }
}
