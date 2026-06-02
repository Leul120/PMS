package com.procurement.apigateway.config;

import lombok.extern.slf4j.Slf4j;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

/**
 * Extracts tenant context before JWT validation runs (order -200).
 *
 * Resolution priority:
 *  1. X-Tenant-ID header (explicit API clients)
 *  2. Subdomain — tenant.yourdomain.com  →  tenantDomain = "tenant"
 *  3. Falls through; JWT filter will use the tenantId embedded in the token.
 */
@Slf4j
@Component
public class TenantIdentificationFilter implements GlobalFilter, Ordered {

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        ServerHttpRequest request = exchange.getRequest();

        // Already set — nothing to do
        if (StringUtils.hasText(request.getHeaders().getFirst("X-Tenant-ID"))) {
            return chain.filter(exchange);
        }

        // Derive from subdomain (tenant.yourdomain.com)
        String host = request.getHeaders().getFirst("Host");
        if (StringUtils.hasText(host)) {
            String tenantDomain = extractSubdomain(host);
            if (tenantDomain != null) {
                ServerHttpRequest mutated = request.mutate()
                    .header("X-Tenant-Domain", tenantDomain)
                    .build();
                log.debug("Tenant domain extracted from host: {}", tenantDomain);
                return chain.filter(exchange.mutate().request(mutated).build());
            }
        }

        return chain.filter(exchange);
    }

    /**
     * Returns the first label of a multi-part host if it looks like a tenant subdomain,
     * i.e. "acme.yourdomain.com" → "acme". Returns null for bare domains or localhost.
     */
    private String extractSubdomain(String host) {
        // Strip port
        int colonIdx = host.lastIndexOf(':');
        if (colonIdx > 0) host = host.substring(0, colonIdx);

        String[] parts = host.split("\\.");
        // Need at least 3 labels (subdomain.domain.tld); skip localhost/IP
        if (parts.length >= 3 && !"localhost".equals(parts[0])) {
            String subdomain = parts[0];
            // Exclude common non-tenant subdomains
            if (!"www".equalsIgnoreCase(subdomain) && !"api".equalsIgnoreCase(subdomain)) {
                return subdomain;
            }
        }
        return null;
    }

    @Override
    public int getOrder() {
        return -200;  // Run before JwtAuthenticationFilter (-100)
    }
}
