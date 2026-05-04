package com.procurement.apigateway.config;

import io.github.resilience4j.circuitbreaker.CircuitBreakerConfig;
import io.github.resilience4j.timelimiter.TimeLimiterConfig;
import org.springframework.cloud.circuitbreaker.resilience4j.ReactiveResilience4JCircuitBreakerFactory;
import org.springframework.cloud.client.circuitbreaker.Customizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Duration;

/**
 * Circuit breaker configuration for API Gateway.
 * Protects downstream services from cascading failures.
 */
@Configuration
public class ApiGatewayCircuitBreakerConfig {

    /**
     * Default circuit breaker configuration
     */
    @Bean
    public Customizer<ReactiveResilience4JCircuitBreakerFactory> defaultCircuitBreakerCustomizer() {
        return factory -> factory.configure(builder -> builder
                .circuitBreakerConfig(CircuitBreakerConfig.custom()
                        .failureRateThreshold(50)
                        .slowCallRateThreshold(80)
                        .slowCallDurationThreshold(Duration.ofSeconds(2))
                        .permittedNumberOfCallsInHalfOpenState(10)
                        .slidingWindowSize(100)
                        .waitDurationInOpenState(Duration.ofSeconds(10))
                        .build())
                .timeLimiterConfig(TimeLimiterConfig.custom()
                        .timeoutDuration(Duration.ofSeconds(5))
                        .build()),
                "default");
    }

    /**
     * Circuit breaker for auth service (higher thresholds as auth is critical)
     */
    @Bean
    public Customizer<ReactiveResilience4JCircuitBreakerFactory> authCircuitBreaker() {
        return factory -> factory.configure(builder -> builder
                .circuitBreakerConfig(CircuitBreakerConfig.custom()
                        .failureRateThreshold(60)
                        .slowCallRateThreshold(90)
                        .slowCallDurationThreshold(Duration.ofSeconds(3))
                        .waitDurationInOpenState(Duration.ofSeconds(5))
                        .build())
                .timeLimiterConfig(TimeLimiterConfig.custom()
                        .timeoutDuration(Duration.ofSeconds(10))
                        .build()),
                "auth-service");
    }

    /**
     * Circuit breaker for analytics service (lower thresholds as queries are heavy)
     */
    @Bean
    public Customizer<ReactiveResilience4JCircuitBreakerFactory> analyticsCircuitBreaker() {
        return factory -> factory.configure(builder -> builder
                .circuitBreakerConfig(CircuitBreakerConfig.custom()
                        .failureRateThreshold(30)
                        .slowCallRateThreshold(50)
                        .slowCallDurationThreshold(Duration.ofSeconds(5))
                        .waitDurationInOpenState(Duration.ofSeconds(30))
                        .build())
                .timeLimiterConfig(TimeLimiterConfig.custom()
                        .timeoutDuration(Duration.ofSeconds(30))
                        .build()),
                "analytics-service");
    }

    /**
     * Circuit breaker for write operations (RFQ, Bids, POs)
     * More strict to prevent data inconsistency
     */
    @Bean
    public Customizer<ReactiveResilience4JCircuitBreakerFactory> writeOperationCircuitBreaker() {
        return factory -> factory.configure(builder -> builder
                .circuitBreakerConfig(CircuitBreakerConfig.custom()
                        .failureRateThreshold(40)
                        .slowCallRateThreshold(70)
                        .slowCallDurationThreshold(Duration.ofSeconds(3))
                        .waitDurationInOpenState(Duration.ofSeconds(15))
                        .build())
                .timeLimiterConfig(TimeLimiterConfig.custom()
                        .timeoutDuration(Duration.ofSeconds(10))
                        .build()),
                "rfq-service", "bidding-service", "procurement-service");
    }
}
