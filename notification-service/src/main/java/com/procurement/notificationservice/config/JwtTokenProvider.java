package com.procurement.notificationservice.config;

import io.jsonwebtoken.*;
import io.jsonwebtoken.security.Keys;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;

@Slf4j
@Component
public class JwtTokenProvider {

    private final SecretKey jwtSecret;

    public JwtTokenProvider(@Value("${jwt.secret:procurement-default-secret-key-change-in-production-min32chars}") String jwtSecretString) {
        this.jwtSecret = Keys.hmacShaKeyFor(jwtSecretString.getBytes(StandardCharsets.UTF_8));
    }

    public boolean validateToken(String authToken) {
        try {
            Jwts.parser().verifyWith(jwtSecret).build().parseSignedClaims(authToken);
            return true;
        } catch (SecurityException | MalformedJwtException | ExpiredJwtException |
                 UnsupportedJwtException | IllegalArgumentException e) {
            log.error("Invalid JWT token: {}", e.getMessage());
        }
        return false;
    }

    public Long getUserIdFromToken(String token) {
        Claims claims = Jwts.parser().verifyWith(jwtSecret).build().parseSignedClaims(token).getPayload();
        return Long.parseLong(claims.getSubject());
    }

    public String getEmailFromToken(String token) {
        Claims claims = Jwts.parser().verifyWith(jwtSecret).build().parseSignedClaims(token).getPayload();
        return claims.get("email", String.class);
    }

    public Long getTenantIdFromToken(String token) {
        Claims claims = Jwts.parser().verifyWith(jwtSecret).build().parseSignedClaims(token).getPayload();
        Object tenantId = claims.get("tenantId");
        if (tenantId == null) return null;
        if (tenantId instanceof Long l) return l;
        if (tenantId instanceof Integer i) return i.longValue();
        return Long.parseLong(tenantId.toString());
    }

    public String getRoleFromToken(String token) {
        Claims claims = Jwts.parser().verifyWith(jwtSecret).build().parseSignedClaims(token).getPayload();
        return claims.get("role", String.class);
    }
}
