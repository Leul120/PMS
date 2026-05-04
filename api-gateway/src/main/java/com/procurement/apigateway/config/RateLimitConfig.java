package com.procurement.apigateway.config;

import org.springframework.cloud.gateway.filter.ratelimit.KeyResolver;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import reactor.core.publisher.Mono;

import java.util.Optional;

/**
 * Rate limiting key resolvers for different strategies.
 */
@Configuration
public class RateLimitConfig {

    /**
     * Key resolver based on client IP address.
     * Used for unauthenticated endpoints.
     */
    @Bean
    @Primary
    public KeyResolver ipKeyResolver() {
        return exchange -> {
            String ip = Optional.ofNullable(exchange.getRequest().getHeaders().getFirst("X-Forwarded-For"))
                    .orElseGet(() -> Optional.ofNullable(exchange.getRequest().getHeaders().getFirst("X-Real-IP"))
                            .orElse(exchange.getRequest().getRemoteAddress() != null
                                    ? exchange.getRequest().getRemoteAddress().getAddress().getHostAddress()
                                    : "unknown"));
            return Mono.just(ip);
        };
    }

    /**
     * Key resolver based on authenticated user ID.
     * Used for authenticated endpoints.
     */
    @Bean
    public KeyResolver userKeyResolver() {
        return exchange -> {
            // Try to get user ID from JWT token or session
            String userId = exchange.getRequest().getHeaders().getFirst("X-User-Id");
            if (userId != null) {
                return Mono.just("user:" + userId);
            }

            // Fallback to IP if no user context
            return ipKeyResolver().resolve(exchange);
        };
    }

    /**
     * Key resolver based on API key.
     * Used for partner/external API access.
     */
    @Bean
    public KeyResolver apiKeyResolver() {
        return exchange -> {
            String apiKey = exchange.getRequest().getHeaders().getFirst("X-API-Key");
            if (apiKey != null) {
                return Mono.just("apikey:" + apiKey);
            }
            return ipKeyResolver().resolve(exchange);
        };
    }

    /**
     * Key resolver combining user and endpoint.
     * For granular per-user per-endpoint limiting.
     */
    @Bean
    public KeyResolver userEndpointKeyResolver() {
        return exchange -> {
            String userId = exchange.getRequest().getHeaders().getFirst("X-User-Id");
            String path = exchange.getRequest().getPath().value();
            String method = exchange.getRequest().getMethod().name();

            String key = userId != null
                    ? "user:" + userId + ":" + method + ":" + path
                    : "ip:" + ipKeyResolver().resolve(exchange).block() + ":" + method + ":" + path;

            return Mono.just(key);
        };
    }
}
