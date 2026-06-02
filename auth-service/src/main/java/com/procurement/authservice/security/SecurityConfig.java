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

                // Super-admin exclusive endpoints (cross-tenant)
                .requestMatchers("/api/super-admin/**").hasRole("SUPER_ADMIN")

                // Current-user profile (any authenticated user)
                .requestMatchers(HttpMethod.GET, "/api/auth/me").authenticated()

                // User list (VENDOR_ADMIN can see their own tenant's users)
                .requestMatchers(HttpMethod.GET, "/api/auth/users")
                    .hasAnyRole("SUPER_ADMIN", "ADMIN", "OFFICER", "MANAGER", "AUDITOR", "DIRECTOR", "VENDOR_ADMIN")

                // Vendor team invitation
                .requestMatchers(HttpMethod.POST, "/api/auth/invite")
                    .hasRole("VENDOR_ADMIN")

                // User profile by ID
                .requestMatchers(HttpMethod.GET, "/api/auth/users/{userId}")
                    .hasAnyRole("SUPER_ADMIN", "ADMIN", "OFFICER", "MANAGER", "AUDITOR", "VENDOR_ADMIN", "VENDOR_SALES", "VENDOR_FINANCE")
                .requestMatchers(HttpMethod.PUT, "/api/auth/users/{userId}")
                    .hasAnyRole("SUPER_ADMIN", "ADMIN", "OFFICER", "MANAGER", "AUDITOR", "VENDOR_ADMIN", "VENDOR_SALES", "VENDOR_FINANCE")

                // Unlock / lock user account
                .requestMatchers(HttpMethod.POST, "/api/auth/users/*/unlock")
                    .hasAnyRole("SUPER_ADMIN", "ADMIN")

                // Audit logs
                .requestMatchers(HttpMethod.GET, "/api/auth/audit-logs")
                    .hasAnyRole("SUPER_ADMIN", "ADMIN", "AUDITOR")

                // Admin user management
                .requestMatchers("/api/auth/admin/users/**").hasAnyRole("SUPER_ADMIN", "ADMIN")
                .requestMatchers("/api/admin/users/**").hasAnyRole("SUPER_ADMIN", "ADMIN")

                // Tenant management
                .requestMatchers("/api/tenants/**").hasAnyRole("SUPER_ADMIN", "ADMIN")

                // Settings — read is authenticated, write is ADMIN/SUPER_ADMIN
                .requestMatchers(HttpMethod.GET, "/api/auth/settings/**").authenticated()
                .requestMatchers(HttpMethod.PUT, "/api/auth/settings")
                    .hasAnyRole("SUPER_ADMIN", "ADMIN")
                .requestMatchers(HttpMethod.PUT, "/api/auth/settings/security")
                    .hasAnyRole("SUPER_ADMIN", "ADMIN")
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
        String frontendUrl = System.getenv().getOrDefault("FRONTEND_URL", "http://localhost:3000");
        configuration.setAllowedOriginPatterns(List.of(
            "http://localhost:3000", "http://localhost:*", "http://127.0.0.1:3000",
            "http://frontend:3000", frontendUrl
        ));
        configuration.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS"));
        configuration.setAllowedHeaders(List.of("Authorization", "Content-Type", "X-Tenant-ID", "X-User-Id"));
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
