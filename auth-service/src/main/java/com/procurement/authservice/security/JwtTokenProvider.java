package com.procurement.authservice.security;

import io.jsonwebtoken.*;
import io.jsonwebtoken.security.Keys;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.UUID;

@Component
@Slf4j
public class JwtTokenProvider {

    @Value("${jwt.expiration:28800000}")
    private long jwtExpiration;

    /**
     * HMAC-SHA256 secret. Must be at least 32 characters.
     * Set JWT_SECRET env var in production. The default is safe for development only.
     */
    @Value("${jwt.secret:procurement-default-secret-key-change-in-production-min32chars}")
    private String jwtSecret;

    private SecretKey getSigningKey() {
        byte[] keyBytes = jwtSecret.getBytes(StandardCharsets.UTF_8);
        return Keys.hmacShaKeyFor(keyBytes);
    }

    public String generateToken(Long userId, String email, String roleName, String permissions, Long tenantId) {
        return generateToken(userId, email, roleName, permissions, tenantId, null);
    }

    public String generateToken(Long userId, String email, String roleName, String permissions,
                              Long tenantId, String operatingContext) {
        Date now = new Date();
        Date expiryDate = new Date(now.getTime() + jwtExpiration);

        var builder = Jwts.builder()
                .id(UUID.randomUUID().toString())
                .subject(String.valueOf(userId))
                .claim("email", email)
                .claim("role", roleName)
                .claim("permissions", permissions)
                .claim("tenantId", tenantId);
        if (operatingContext != null && !operatingContext.isBlank()) {
            builder.claim("operatingContext", operatingContext);
        }
        return builder
                .issuedAt(now)
                .expiration(expiryDate)
                .signWith(getSigningKey())
                .compact();
    }

    public String getOperatingContextFromToken(String token) {
        return parseToken(token).get("operatingContext", String.class);
    }

    public Long getUserIdFromToken(String token) {
        return Long.parseLong(parseToken(token).getSubject());
    }

    public String getEmailFromToken(String token) {
        return parseToken(token).get("email", String.class);
    }

    public String getRoleFromToken(String token) {
        return parseToken(token).get("role", String.class);
    }

    public Long getTenantIdFromToken(String token) {
        Object tenantId = parseToken(token).get("tenantId");
        if (tenantId == null) return null;
        if (tenantId instanceof Long l) return l;
        if (tenantId instanceof Integer i) return i.longValue();
        return Long.parseLong(tenantId.toString());
    }

    public String getJtiFromToken(String token) {
        return parseToken(token).getId();
    }

    public Date getExpirationDateFromToken(String token) {
        return parseToken(token).getExpiration();
    }

    public Date getIssuedAtFromToken(String token) {
        return parseToken(token).getIssuedAt();
    }

    public Long getUserIdFromTokenQuiet(String token) {
        try { return getUserIdFromToken(token); } catch (Exception e) { return null; }
    }

    public boolean validateToken(String token) {
        try {
            parseToken(token);
            return true;
        } catch (SecurityException | MalformedJwtException e) {
            log.error("Invalid JWT signature: {}", e.getMessage());
        } catch (ExpiredJwtException e) {
            log.error("JWT token expired: {}", e.getMessage());
        } catch (UnsupportedJwtException e) {
            log.error("Unsupported JWT token: {}", e.getMessage());
        } catch (IllegalArgumentException e) {
            log.error("JWT claims string is empty: {}", e.getMessage());
        }
        return false;
    }

    private Claims parseToken(String token) {
        return Jwts.parser()
                .verifyWith(getSigningKey())
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }
}
