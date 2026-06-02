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
public class VendorClient {

    private final WebClient vendorWebClient;

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

    public Map<String, Object> getVendorByUserIdFallback(Long userId, Throwable t) {
        log.warn("Vendor by userId fallback for userId {}: {}", userId, t.getMessage());
        return null;
    }
}
