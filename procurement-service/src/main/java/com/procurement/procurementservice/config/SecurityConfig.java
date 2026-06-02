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
                // GET requisitions - internal roles + director/super-admin
                .requestMatchers(HttpMethod.GET, "/api/procurement/requisitions", "/api/procurement/requisitions/**")
                    .hasAnyRole("ADMIN", "OFFICER", "MANAGER", "AUDITOR", "DIRECTOR", "REQUESTER", "SUPER_ADMIN")
                // POST approve requisition - ADMIN, MANAGER, DIRECTOR
                .requestMatchers(HttpMethod.POST, "/api/procurement/requisitions/*/approve")
                    .hasAnyRole("ADMIN", "MANAGER", "DIRECTOR", "SUPER_ADMIN")
                .requestMatchers(HttpMethod.POST, "/api/procurement/requisitions/*/submit")
                    .hasAnyRole("ADMIN", "OFFICER", "MANAGER", "REQUESTER", "SUPER_ADMIN")
                // POST create requisition - ADMIN, OFFICER, MANAGER, REQUESTER
                .requestMatchers(HttpMethod.POST, "/api/procurement/requisitions")
                    .hasAnyRole("ADMIN", "OFFICER", "MANAGER", "REQUESTER", "SUPER_ADMIN")

                // ── Purchase Orders ───────────────────────────────────────
                // GET purchase orders - all roles including vendor (vendors see their own POs)
                .requestMatchers(HttpMethod.GET, "/api/purchase-orders", "/api/purchase-orders/**")
                    .hasAnyRole("ADMIN", "OFFICER", "MANAGER", "AUDITOR", "DIRECTOR", "SUPER_ADMIN", "VENDOR", "VENDOR_ADMIN", "VENDOR_SALES", "VENDOR_FINANCE")
                // POST approve/reject purchase order - ADMIN, MANAGER, DIRECTOR, SUPER_ADMIN
                .requestMatchers(HttpMethod.POST, "/api/purchase-orders/*/approve", "/api/purchase-orders/*/reject")
                    .hasAnyRole("ADMIN", "MANAGER", "DIRECTOR", "SUPER_ADMIN")
                // POST create purchase order - ADMIN, OFFICER, SUPER_ADMIN
                .requestMatchers(HttpMethod.POST, "/api/purchase-orders")
                    .hasAnyRole("ADMIN", "OFFICER", "SUPER_ADMIN")
                // PUT status change - ADMIN, OFFICER, MANAGER, SUPER_ADMIN
                .requestMatchers(HttpMethod.PUT, "/api/purchase-orders/*/status")
                    .hasAnyRole("ADMIN", "OFFICER", "MANAGER", "SUPER_ADMIN")
                // PUT update purchase order - ADMIN, OFFICER, SUPER_ADMIN
                .requestMatchers(HttpMethod.PUT, "/api/purchase-orders/*")
                    .hasAnyRole("ADMIN", "OFFICER", "SUPER_ADMIN")

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
        configuration.setAllowedHeaders(List.of("Authorization", "Content-Type", "X-User-Id"));
        configuration.setAllowCredentials(false);
        configuration.setExposedHeaders(List.of("Authorization", "Content-Type"));
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }
}


