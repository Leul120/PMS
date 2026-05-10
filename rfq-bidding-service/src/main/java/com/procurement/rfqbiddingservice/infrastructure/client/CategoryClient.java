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
public class CategoryClient {

    private final WebClient vendorWebClient;

    @CircuitBreaker(name = "vendorService", fallbackMethod = "getCategoryByIdFallback")
    @Retry(name = "vendorService")
    public Map<String, Object> getCategoryById(Long categoryId) {
        return vendorWebClient.get()
                .uri("/api/vendors/categories/{id}", categoryId)
                .retrieve()
                .bodyToMono(new ParameterizedTypeReference<Map<String, Object>>() {})
                .doOnError(e -> log.error("Error fetching category {}: {}", categoryId, e.getMessage()))
                .block();
    }

    /** Returns the category name for a given categoryId, or a safe fallback. */
    public String getCategoryName(Long categoryId) {
        if (categoryId == null) return null;
        try {
            Map<String, Object> category = getCategoryById(categoryId);
            if (category != null) {
                Object name = category.get("categoryName");
                if (name != null) return name.toString();
            }
        } catch (Exception e) {
            log.warn("Could not resolve category name for id {}: {}", categoryId, e.getMessage());
        }
        return "Category #" + categoryId;
    }

    // Fallback
    public Map<String, Object> getCategoryByIdFallback(Long categoryId, Throwable t) {
        log.warn("Category service fallback for id {}: {}", categoryId, t.getMessage());
        return Map.of("categoryName", "Category #" + categoryId);
    }
}
