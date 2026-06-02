package com.procurement.rfqbiddingservice.config;

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
                // Swagger
                .requestMatchers("/swagger-ui/**", "/v3/api-docs/**").permitAll()
                // OPTIONS requests
                .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()

                // ── RFQ endpoints ──
                // POST /api/rfqs (create) - ADMIN, OFFICER, SUPER_ADMIN
                .requestMatchers(HttpMethod.POST, "/api/rfqs").hasAnyRole("ADMIN", "OFFICER", "SUPER_ADMIN")
                // POST /api/rfqs/{id}/close - ADMIN, OFFICER, SUPER_ADMIN
                .requestMatchers(HttpMethod.POST, "/api/rfqs/*/close").hasAnyRole("ADMIN", "OFFICER", "SUPER_ADMIN")
                .requestMatchers(HttpMethod.POST, "/api/rfqs/*/cancel").hasAnyRole("ADMIN", "OFFICER", "SUPER_ADMIN")
                // PUT /api/rfqs/{id} (update) - ADMIN, OFFICER, SUPER_ADMIN
                .requestMatchers(HttpMethod.PUT, "/api/rfqs/*").hasAnyRole("ADMIN", "OFFICER", "SUPER_ADMIN")
                // GET /api/rfqs/status/{status} - internal roles + SUPER_ADMIN, DIRECTOR
                .requestMatchers(HttpMethod.GET, "/api/rfqs/status/*").hasAnyRole("ADMIN", "OFFICER", "MANAGER", "AUDITOR", "DIRECTOR", "SUPER_ADMIN")
                // GET /api/rfqs/{id}/winning-bid - internal procurement + officer roles
                .requestMatchers(HttpMethod.GET, "/api/rfqs/*/winning-bid").hasAnyRole("ADMIN", "OFFICER", "MANAGER", "AUDITOR", "DIRECTOR", "SUPER_ADMIN")
                // GET /api/rfqs and /api/rfqs/{id} - all roles including vendor
                .requestMatchers(HttpMethod.GET, "/api/rfqs", "/api/rfqs/*").hasAnyRole("ADMIN", "OFFICER", "MANAGER", "AUDITOR", "DIRECTOR", "SUPER_ADMIN", "VENDOR", "VENDOR_ADMIN", "VENDOR_SALES", "VENDOR_FINANCE")

                // ── Bid endpoints ──
                // POST /api/bids/{id}/evaluate - ADMIN, OFFICER, SUPER_ADMIN
                .requestMatchers(HttpMethod.POST, "/api/bids/*/evaluate").hasAnyRole("ADMIN", "OFFICER", "SUPER_ADMIN")
                // POST /api/bids/{id}/award - ADMIN, OFFICER, SUPER_ADMIN
                .requestMatchers(HttpMethod.POST, "/api/bids/*/award").hasAnyRole("ADMIN", "OFFICER", "SUPER_ADMIN")
                // POST /api/bids (submit bid) - vendor roles + ADMIN, OFFICER, SUPER_ADMIN
                .requestMatchers(HttpMethod.POST, "/api/bids").hasAnyRole("ADMIN", "OFFICER", "SUPER_ADMIN", "VENDOR", "VENDOR_ADMIN", "VENDOR_SALES")
                // GET /api/bids/{id} - all roles including vendor
                .requestMatchers(HttpMethod.GET, "/api/bids/*").hasAnyRole("ADMIN", "OFFICER", "MANAGER", "AUDITOR", "DIRECTOR", "SUPER_ADMIN", "VENDOR", "VENDOR_ADMIN", "VENDOR_SALES", "VENDOR_FINANCE")
                // GET /api/bids/rfq/{id}/ranked - ADMIN, OFFICER, MANAGER, AUDITOR
                .requestMatchers(HttpMethod.GET, "/api/bids/rfq/*/ranked").hasAnyRole("ADMIN", "OFFICER", "MANAGER", "AUDITOR", "DIRECTOR", "SUPER_ADMIN")
                // GET /api/bids/rfq/{id}, /api/bids/vendor/{id} - all roles including vendor
                .requestMatchers(HttpMethod.GET, "/api/bids/**").hasAnyRole("ADMIN", "OFFICER", "MANAGER", "AUDITOR", "DIRECTOR", "SUPER_ADMIN", "VENDOR", "VENDOR_ADMIN", "VENDOR_SALES", "VENDOR_FINANCE")

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


