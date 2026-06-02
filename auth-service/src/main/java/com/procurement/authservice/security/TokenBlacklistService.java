package com.procurement.authservice.security;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.Date;

@Service
@RequiredArgsConstructor
@Slf4j
public class TokenBlacklistService {

    private static final String BLACKLIST_PREFIX = "jwt:blacklist:";
    private static final String USER_REVOKE_PREFIX = "user:revoked:";
    /** Tokens issued before the stored revocation time are invalidated. TTL = max token lifetime. */
    private static final Duration USER_REVOKE_TTL = Duration.ofHours(8);

    private final StringRedisTemplate redisTemplate;
    private final JwtTokenProvider jwtTokenProvider;

    public void blacklist(String token) {
        try {
            String jti = jwtTokenProvider.getJtiFromToken(token);
            Date expiry = jwtTokenProvider.getExpirationDateFromToken(token);
            long ttlMillis = expiry.getTime() - System.currentTimeMillis();
            if (ttlMillis > 0) {
                redisTemplate.opsForValue().set(
                    BLACKLIST_PREFIX + jti, "1", Duration.ofMillis(ttlMillis));
                log.info("JWT blacklisted: jti={}", jti);
            }
        } catch (Exception e) {
            log.error("Failed to blacklist JWT token: {}", e.getMessage());
        }
    }

    public boolean isBlacklisted(String token) {
        try {
            String jti = jwtTokenProvider.getJtiFromToken(token);
            return Boolean.TRUE.equals(redisTemplate.hasKey(BLACKLIST_PREFIX + jti));
        } catch (Exception e) {
            return false;
        }
    }

    /** Marks all existing tokens for a user as invalid. Tokens issued before this call will be rejected. */
    public void revokeUserTokens(Long userId) {
        try {
            String key = USER_REVOKE_PREFIX + userId;
            redisTemplate.opsForValue().set(key, String.valueOf(System.currentTimeMillis()), USER_REVOKE_TTL);
            log.info("All tokens revoked for userId={}", userId);
        } catch (Exception e) {
            log.error("Failed to revoke tokens for userId {}: {}", userId, e.getMessage());
        }
    }

    /** Returns true if the token was issued before the user's revocation timestamp. */
    public boolean isRevokedForUser(String token) {
        try {
            Long userId = jwtTokenProvider.getUserIdFromTokenQuiet(token);
            if (userId == null) return false;
            String stored = redisTemplate.opsForValue().get(USER_REVOKE_PREFIX + userId);
            if (stored == null) return false;
            Date iat = jwtTokenProvider.getIssuedAtFromToken(token);
            return iat != null && iat.getTime() < Long.parseLong(stored);
        } catch (Exception e) {
            return false;
        }
    }
}
