package com.procurement.deliveryinvoiceservice.config;

import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

@Configuration
@EnableWebSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtAuthenticationFilter;

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .csrf(AbstractHttpConfigurer::disable)
            .cors(cors -> cors.configurationSource(corsConfigurationSource()))
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                // Swagger & actuator
                .requestMatchers("/swagger-ui/**", "/v3/api-docs/**", "/actuator/**").permitAll()
                // OPTIONS requests
                .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()

                // ── Deliveries ──────────────────────────────────────────────
                .requestMatchers(HttpMethod.GET, "/api/deliveries/**").hasAnyRole("ADMIN", "OFFICER", "MANAGER", "AUDITOR", "VENDOR")
                .requestMatchers(HttpMethod.PUT, "/api/deliveries/*/status").hasAnyRole("ADMIN", "OFFICER", "VENDOR")
                .requestMatchers(HttpMethod.POST, "/api/deliveries").hasAnyRole("ADMIN", "OFFICER", "VENDOR")

                // ── Invoices ────────────────────────────────────────────────
                .requestMatchers(HttpMethod.GET, "/api/invoices/**").hasAnyRole("ADMIN", "OFFICER", "MANAGER", "AUDITOR", "VENDOR")
                .requestMatchers(HttpMethod.GET, "/api/invoices/vendor/**").hasAnyRole("ADMIN", "OFFICER", "MANAGER", "AUDITOR", "VENDOR")
                .requestMatchers(HttpMethod.POST, "/api/invoices/{invoiceId}/validate").hasAnyRole("ADMIN", "OFFICER")
                .requestMatchers(HttpMethod.POST, "/api/invoices/{invoiceId}/dispute").hasAnyRole("ADMIN", "OFFICER", "VENDOR")
                .requestMatchers(HttpMethod.POST, "/api/invoices").hasAnyRole("ADMIN", "OFFICER", "VENDOR")

                // ── Three-Way Match ─────────────────────────────────────────
                .requestMatchers(HttpMethod.POST, "/api/threewaymatch/validate").hasAnyRole("ADMIN", "OFFICER")
                .requestMatchers(HttpMethod.GET, "/api/threewaymatch/**").hasAnyRole("ADMIN", "OFFICER", "MANAGER", "AUDITOR")

                // ── Disputes ────────────────────────────────────────────────
                .requestMatchers(HttpMethod.POST, "/api/disputes/{disputeId}/resolve").hasAnyRole("ADMIN", "OFFICER", "MANAGER")
                .requestMatchers(HttpMethod.POST, "/api/disputes").hasAnyRole("ADMIN", "OFFICER", "VENDOR")
                .requestMatchers(HttpMethod.GET, "/api/disputes/{disputeId}").hasAnyRole("ADMIN", "OFFICER", "MANAGER", "AUDITOR", "VENDOR")
                .requestMatchers(HttpMethod.GET, "/api/disputes/status/**").hasAnyRole("ADMIN", "OFFICER", "MANAGER", "AUDITOR")
                .requestMatchers(HttpMethod.GET, "/api/disputes").hasAnyRole("ADMIN", "OFFICER", "MANAGER", "AUDITOR")

                .anyRequest().authenticated()
            )
            .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);
        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOriginPatterns(List.of("*"));
        configuration.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS"));
        configuration.setAllowedHeaders(List.of("*"));
        configuration.setAllowCredentials(true);
        configuration.setExposedHeaders(List.of("Authorization", "Content-Type"));
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }
}


