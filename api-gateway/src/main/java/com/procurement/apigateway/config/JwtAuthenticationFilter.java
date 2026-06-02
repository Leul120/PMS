package com.procurement.apigateway.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.data.redis.core.ReactiveStringRedisTemplate;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.http.server.reactive.ServerHttpResponse;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

@Slf4j
@Component
@RequiredArgsConstructor
public class JwtAuthenticationFilter implements GlobalFilter, Ordered {

    private final JwtTokenProvider tokenProvider;
    private final ReactiveStringRedisTemplate redisTemplate;

    private static final String BLACKLIST_PREFIX = "jwt:blacklist:";
    private static final String USER_REVOKE_PREFIX = "user:revoked:";

    private static final String[] PUBLIC_PATHS = {
        "/api/auth/login",
        "/api/auth/register",
        "/api/auth/forgot-password",
        "/api/auth/reset-password",
        "/swagger-ui",
        "/v3/api-docs",
        "/actuator"
    };

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        ServerHttpRequest request = exchange.getRequest();
        String path = request.getURI().getPath();

        if (request.getMethod() == HttpMethod.OPTIONS) {
            return chain.filter(exchange);
        }

        if (isPublicPath(path)) {
            return chain.filter(exchange);
        }

        String token = getJwtFromRequest(request);

        if (!StringUtils.hasText(token)) {
            return unauthorized(exchange.getResponse(), "Missing Authorization header");
        }

        if (!tokenProvider.validateToken(token)) {
            return unauthorized(exchange.getResponse(), "Invalid or expired token");
        }

        String jti;
        try {
            jti = tokenProvider.getJtiFromToken(token);
        } catch (Exception e) {
            jti = null;
        }

        if (jti != null) {
            String blacklistKey = BLACKLIST_PREFIX + jti;
            return redisTemplate.hasKey(blacklistKey)
                .flatMap(blacklisted -> {
                    if (Boolean.TRUE.equals(blacklisted)) {
                        return unauthorized(exchange.getResponse(), "Token has been invalidated");
                    }
                    return checkUserRevocation(exchange, chain, token);
                })
                .onErrorResume(e -> {
                    log.warn("Redis blacklist check failed, allowing request: {}", e.getMessage());
                    return checkUserRevocation(exchange, chain, token);
                });
        }

        return checkUserRevocation(exchange, chain, token);
    }

    private Mono<Void> checkUserRevocation(ServerWebExchange exchange, GatewayFilterChain chain, String token) {
        Long userId;
        try { userId = tokenProvider.getUserIdFromToken(token); } catch (Exception e) { userId = null; }
        if (userId == null) return proceedWithAuth(exchange, chain, token);
        final Long uid = userId;
        return redisTemplate.opsForValue().get(USER_REVOKE_PREFIX + uid)
            .flatMap(revokedAtStr -> {
                try {
                    long revokedAt = Long.parseLong(revokedAtStr);
                    java.util.Date iat = tokenProvider.getIssuedAtFromToken(token);
                    if (iat != null && iat.getTime() < revokedAt) {
                        return unauthorized(exchange.getResponse(), "Token has been invalidated due to password change");
                    }
                } catch (Exception e) {
                    log.warn("Error parsing user revocation timestamp for userId={}: {}", uid, e.getMessage());
                }
                return proceedWithAuth(exchange, chain, token);
            })
            .switchIfEmpty(proceedWithAuth(exchange, chain, token))
            .onErrorResume(e -> {
                log.warn("Redis user-revocation check failed, allowing request: {}", e.getMessage());
                return proceedWithAuth(exchange, chain, token);
            });
    }

    private Mono<Void> proceedWithAuth(ServerWebExchange exchange, GatewayFilterChain chain, String token) {
        Long userId = tokenProvider.getUserIdFromToken(token);
        Long tenantId = tokenProvider.getTenantIdFromToken(token);
        log.debug("JWT validated at gateway — userId={}, tenantId={}", userId, tenantId);
        exchange.getAttributes().put("userId", userId);
        exchange.getAttributes().put("tenantId", tenantId);
        return chain.filter(exchange);
    }

    private boolean isPublicPath(String path) {
        for (String publicPath : PUBLIC_PATHS) {
            if (path.startsWith(publicPath)) {
                return true;
            }
        }
        return false;
    }

    private String getJwtFromRequest(ServerHttpRequest request) {
        String bearerToken = request.getHeaders().getFirst(HttpHeaders.AUTHORIZATION);
        if (StringUtils.hasText(bearerToken) && bearerToken.startsWith("Bearer ")) {
            return bearerToken.substring(7);
        }
        return null;
    }

    private Mono<Void> unauthorized(ServerHttpResponse response, String message) {
        response.setStatusCode(HttpStatus.UNAUTHORIZED);
        return response.writeWith(Mono.just(response.bufferFactory()
            .wrap(("{\"error\": \"Unauthorized\", \"message\": \"" + message + "\"}").getBytes())));
    }

    @Override
    public int getOrder() {
        return -100;
    }
}
