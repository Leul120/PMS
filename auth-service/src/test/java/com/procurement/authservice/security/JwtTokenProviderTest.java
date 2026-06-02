package com.procurement.authservice.security;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import static org.assertj.core.api.Assertions.*;

class JwtTokenProviderTest {

    private JwtTokenProvider provider;

    @BeforeEach
    void setUp() {
        provider = new JwtTokenProvider();
        ReflectionTestUtils.setField(provider, "jwtSecret", "test-secret-key-must-be-at-least-32-chars-long!!");
        ReflectionTestUtils.setField(provider, "jwtExpiration", 3600000L);
    }

    @Test
    void generateToken_containsTenantId() {
        String token = provider.generateToken(1L, "user@example.com", "VENDOR", "READ", 42L);
        assertThat(provider.getTenantIdFromToken(token)).isEqualTo(42L);
    }

    @Test
    void generateToken_containsUserId() {
        String token = provider.generateToken(99L, "user@example.com", "ADMIN", "ALL", 1L);
        assertThat(provider.getUserIdFromToken(token)).isEqualTo(99L);
    }

    @Test
    void generateToken_containsEmail() {
        String token = provider.generateToken(1L, "test@domain.com", "VENDOR", "READ", 1L);
        assertThat(provider.getEmailFromToken(token)).isEqualTo("test@domain.com");
    }

    @Test
    void generateToken_containsRole() {
        String token = provider.generateToken(1L, "user@example.com", "PROCUREMENT_OFFICER", "READ", 1L);
        assertThat(provider.getRoleFromToken(token)).isEqualTo("PROCUREMENT_OFFICER");
    }

    @Test
    void validateToken_returnsTrueForValidToken() {
        String token = provider.generateToken(1L, "user@example.com", "VENDOR", "READ", 1L);
        assertThat(provider.validateToken(token)).isTrue();
    }

    @Test
    void validateToken_returnsFalseForInvalidToken() {
        assertThat(provider.validateToken("not.a.valid.token")).isFalse();
    }

    @Test
    void validateToken_returnsFalseForTamperedToken() {
        String token = provider.generateToken(1L, "user@example.com", "VENDOR", "READ", 1L);
        assertThat(provider.validateToken(token + "tampered")).isFalse();
    }

    @Test
    void getTenantIdFromToken_differentTenantIds() {
        String token1 = provider.generateToken(1L, "a@x.com", "VENDOR", "READ", 1L);
        String token2 = provider.generateToken(1L, "a@x.com", "VENDOR", "READ", 999L);
        assertThat(provider.getTenantIdFromToken(token1)).isEqualTo(1L);
        assertThat(provider.getTenantIdFromToken(token2)).isEqualTo(999L);
    }

    @Test
    void differentUsers_sameEmail_differentUserIds() {
        String token1 = provider.generateToken(10L, "same@email.com", "VENDOR", "READ", 1L);
        String token2 = provider.generateToken(20L, "same@email.com", "VENDOR", "READ", 2L);
        assertThat(provider.getUserIdFromToken(token1)).isEqualTo(10L);
        assertThat(provider.getUserIdFromToken(token2)).isEqualTo(20L);
        assertThat(provider.getTenantIdFromToken(token1)).isEqualTo(1L);
        assertThat(provider.getTenantIdFromToken(token2)).isEqualTo(2L);
    }
}
