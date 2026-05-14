package com.procurement.vendorservice.config;

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
                .requestMatchers("/swagger-ui/**", "/v3/api-docs/**").permitAll()
                .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                // Vendor registration
                .requestMatchers(HttpMethod.POST, "/api/vendors/register").hasAnyRole("ADMIN", "OFFICER", "VENDOR")
                // Vendor list
                .requestMatchers(HttpMethod.GET, "/api/vendors").hasAnyRole("ADMIN", "OFFICER", "MANAGER", "AUDITOR")
                // Vendor by status
                .requestMatchers(HttpMethod.GET, "/api/vendors/status/**").hasAnyRole("ADMIN", "OFFICER", "MANAGER", "AUDITOR")
                // Categories — permitAll for service-to-service lookups (e.g. rfq-bidding-service → vendor-service)
                .requestMatchers(HttpMethod.GET, "/api/vendors/categories/**").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/vendors/categories").permitAll()
                .requestMatchers(HttpMethod.POST, "/api/vendors/categories").hasAnyRole("ADMIN", "OFFICER")
                // Documents
                .requestMatchers(HttpMethod.GET, "/api/vendors/documents/expiring").hasAnyRole("ADMIN", "OFFICER", "MANAGER")
                .requestMatchers(HttpMethod.DELETE, "/api/vendors/documents/**").hasAnyRole("ADMIN", "OFFICER")
                .requestMatchers(HttpMethod.POST, "/api/vendors/*/documents").hasAnyRole("ADMIN", "OFFICER", "VENDOR")
                .requestMatchers(HttpMethod.GET, "/api/vendors/*/documents").hasAnyRole("ADMIN", "OFFICER", "MANAGER", "AUDITOR", "VENDOR")
                // Vendor verify
                .requestMatchers(HttpMethod.POST, "/api/vendors/*/verify").hasAnyRole("ADMIN", "OFFICER")
                // Vendor status update
                .requestMatchers(HttpMethod.PUT, "/api/vendors/*/status").hasAnyRole("ADMIN", "OFFICER")
                // Vendor by user
                .requestMatchers(HttpMethod.GET, "/api/vendors/user/**").hasAnyRole("ADMIN", "OFFICER", "MANAGER", "AUDITOR", "VENDOR")
                // Batch lookup — used by internal service-to-service calls (no JWT)
                .requestMatchers(HttpMethod.POST, "/api/vendors/batch").permitAll()
                // Single vendor get — permitAll so procurement-service can call without JWT
                .requestMatchers(HttpMethod.GET, "/api/vendors/*").permitAll()
                .requestMatchers(HttpMethod.PUT, "/api/vendors/*").hasAnyRole("ADMIN", "OFFICER", "VENDOR")
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
