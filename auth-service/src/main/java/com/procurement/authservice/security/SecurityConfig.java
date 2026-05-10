package com.procurement.authservice.security;

import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
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
                // Preflight requests
                .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()

                // Public auth endpoints
                .requestMatchers("/api/auth/login", "/api/auth/register",
                                 "/api/auth/forgot-password", "/api/auth/reset-password").permitAll()

                // Swagger / OpenAPI
                .requestMatchers("/swagger-ui/**", "/v3/api-docs/**").permitAll()

                // Current-user profile (any authenticated user)
                .requestMatchers(HttpMethod.GET, "/api/auth/me").authenticated()

                // User list — ADMIN, OFFICER, MANAGER, AUDITOR
                .requestMatchers(HttpMethod.GET, "/api/auth/users").hasAnyRole("ADMIN", "OFFICER", "MANAGER", "AUDITOR")

                // User profile by ID — any authenticated role can view/update own profile
                .requestMatchers(HttpMethod.GET, "/api/auth/users/{userId}").hasAnyRole("ADMIN", "OFFICER", "MANAGER", "AUDITOR", "VENDOR")
                .requestMatchers(HttpMethod.PUT, "/api/auth/users/{userId}").hasAnyRole("ADMIN", "OFFICER", "MANAGER", "AUDITOR", "VENDOR")

                // Unlock user account — ADMIN only
                .requestMatchers(HttpMethod.POST, "/api/auth/users/*/unlock").hasRole("ADMIN")

                // Audit logs — ADMIN, AUDITOR
                .requestMatchers(HttpMethod.GET, "/api/auth/audit-logs").hasAnyRole("ADMIN", "AUDITOR")

                // Admin user management under /api/auth/admin/users/**
                .requestMatchers("/api/auth/admin/users/**").hasRole("ADMIN")

                // Admin user management under /api/admin/users/** (UserManagementController)
                .requestMatchers("/api/admin/users/**").hasRole("ADMIN")

                // Settings — read is authenticated, write is ADMIN
                .requestMatchers(HttpMethod.GET, "/api/auth/settings/**").authenticated()
                .requestMatchers(HttpMethod.PUT, "/api/auth/settings").hasRole("ADMIN")
                .requestMatchers(HttpMethod.PUT, "/api/auth/settings/security").hasRole("ADMIN")
                .requestMatchers(HttpMethod.PUT, "/api/auth/settings/notifications").authenticated()

                // Everything else requires authentication
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

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(10);
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration config) throws Exception {
        return config.getAuthenticationManager();
    }
}
