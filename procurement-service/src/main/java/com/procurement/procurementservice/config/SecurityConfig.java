package com.procurement.procurementservice.config;

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
                // CORS preflight
                .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()

                // ── Requisitions ──────────────────────────────────────────
                // GET requisitions - ADMIN, OFFICER, MANAGER, AUDITOR
                .requestMatchers(HttpMethod.GET, "/api/procurement/requisitions", "/api/procurement/requisitions/**")
                    .hasAnyRole("ADMIN", "OFFICER", "MANAGER", "AUDITOR")
                // POST approve requisition - ADMIN, MANAGER
                .requestMatchers(HttpMethod.POST, "/api/procurement/requisitions/*/approve")
                    .hasAnyRole("ADMIN", "MANAGER")
                // POST create requisition - ADMIN, OFFICER, MANAGER
                .requestMatchers(HttpMethod.POST, "/api/procurement/requisitions")
                    .hasAnyRole("ADMIN", "OFFICER", "MANAGER")

                // ── Purchase Orders ───────────────────────────────────────
                // GET purchase orders - ADMIN, OFFICER, MANAGER, AUDITOR, VENDOR
                .requestMatchers(HttpMethod.GET, "/api/purchase-orders", "/api/purchase-orders/**")
                    .hasAnyRole("ADMIN", "OFFICER", "MANAGER", "AUDITOR", "VENDOR")
                // POST approve/reject purchase order - ADMIN, MANAGER
                .requestMatchers(HttpMethod.POST, "/api/purchase-orders/*/approve", "/api/purchase-orders/*/reject")
                    .hasAnyRole("ADMIN", "MANAGER")
                // POST create purchase order - ADMIN, OFFICER
                .requestMatchers(HttpMethod.POST, "/api/purchase-orders")
                    .hasAnyRole("ADMIN", "OFFICER")
                // PUT status change - ADMIN, OFFICER, MANAGER
                .requestMatchers(HttpMethod.PUT, "/api/purchase-orders/*/status")
                    .hasAnyRole("ADMIN", "OFFICER", "MANAGER")
                // PUT update purchase order - ADMIN, OFFICER
                .requestMatchers(HttpMethod.PUT, "/api/purchase-orders/*")
                    .hasAnyRole("ADMIN", "OFFICER")

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


