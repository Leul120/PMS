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
                // POST /api/rfqs (create) - ADMIN, OFFICER
                .requestMatchers(HttpMethod.POST, "/api/rfqs").hasAnyRole("ADMIN", "OFFICER")
                // POST /api/rfqs/{id}/close - ADMIN, OFFICER
                .requestMatchers(HttpMethod.POST, "/api/rfqs/*/close").hasAnyRole("ADMIN", "OFFICER")
                // PUT /api/rfqs/{id} (update) - ADMIN, OFFICER
                .requestMatchers(HttpMethod.PUT, "/api/rfqs/*").hasAnyRole("ADMIN", "OFFICER")
                // GET /api/rfqs/status/{status} - ADMIN, OFFICER, MANAGER, AUDITOR
                .requestMatchers(HttpMethod.GET, "/api/rfqs/status/*").hasAnyRole("ADMIN", "OFFICER", "MANAGER", "AUDITOR")
                // GET /api/rfqs and /api/rfqs/{id} - ADMIN, OFFICER, MANAGER, AUDITOR, VENDOR
                .requestMatchers(HttpMethod.GET, "/api/rfqs", "/api/rfqs/*").hasAnyRole("ADMIN", "OFFICER", "MANAGER", "AUDITOR", "VENDOR")

                // ── Bid endpoints ──
                // POST /api/bids/{id}/evaluate - ADMIN, OFFICER
                .requestMatchers(HttpMethod.POST, "/api/bids/*/evaluate").hasAnyRole("ADMIN", "OFFICER")
                // POST /api/bids/{id}/award - ADMIN, OFFICER
                .requestMatchers(HttpMethod.POST, "/api/bids/*/award").hasAnyRole("ADMIN", "OFFICER")
                // POST /api/bids (submit bid) - ADMIN, OFFICER, VENDOR
                .requestMatchers(HttpMethod.POST, "/api/bids").hasAnyRole("ADMIN", "OFFICER", "VENDOR")
                // GET /api/bids/rfq/{id}/ranked - ADMIN, OFFICER, MANAGER, AUDITOR
                .requestMatchers(HttpMethod.GET, "/api/bids/rfq/*/ranked").hasAnyRole("ADMIN", "OFFICER", "MANAGER", "AUDITOR")
                // GET /api/bids/rfq/{id}, /api/bids/vendor/{id} - ADMIN, OFFICER, MANAGER, AUDITOR, VENDOR
                .requestMatchers(HttpMethod.GET, "/api/bids/**").hasAnyRole("ADMIN", "OFFICER", "MANAGER", "AUDITOR", "VENDOR")

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


