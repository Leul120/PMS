package com.procurement.analyticsservice.config;

/**
 * Thread-local holder for the incoming JWT token.
 * The JwtAuthenticationFilter stores the raw token here so WebClient
 * calls can forward it to downstream services.
 */
public class TokenHolder {

    private static final ThreadLocal<String> TOKEN = new ThreadLocal<>();

    public static void set(String token) {
        TOKEN.set(token);
    }

    public static String get() {
        return TOKEN.get();
    }

    public static void clear() {
        TOKEN.remove();
    }
}
