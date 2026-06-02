package com.procurement.apigateway.config;

import org.springframework.cloud.gateway.filter.ratelimit.KeyResolver;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import reactor.core.publisher.Mono;

import java.util.Optional;

@Configuration
public class RateLimitConfig {

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

    @Bean
    public KeyResolver userKeyResolver() {
        return exchange -> {
            Object userId = exchange.getAttribute("userId");
            if (userId != null) {
                return Mono.just("user:" + userId);
            }
            return ipKeyResolver().resolve(exchange);
        };
    }

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

    @Bean
    public KeyResolver userEndpointKeyResolver() {
        return exchange -> {
            Object userId = exchange.getAttribute("userId");
            String path = exchange.getRequest().getPath().value();
            String method = exchange.getRequest().getMethod().name();
            String key = userId != null
                    ? "user:" + userId + ":" + method + ":" + path
                    : "ip:" + exchange.getRequest().getRemoteAddress().getAddress().getHostAddress()
                        + ":" + method + ":" + path;
            return Mono.just(key);
        };
    }

    @Bean
    public KeyResolver tenantKeyResolver() {
        return exchange -> {
            Object tenantId = exchange.getAttribute("tenantId");
            if (tenantId != null) {
                return Mono.just("tenant:" + tenantId);
            }
            return ipKeyResolver().resolve(exchange);
        };
    }

    @Bean
    public KeyResolver tenantUserKeyResolver() {
        return exchange -> {
            Object tenantId = exchange.getAttribute("tenantId");
            Object userId = exchange.getAttribute("userId");
            if (tenantId != null && userId != null) {
                return Mono.just("tenant:" + tenantId + ":user:" + userId);
            }
            return ipKeyResolver().resolve(exchange);
        };
    }
}
