package com.procurement.authservice.security;

import com.procurement.authservice.tenant.TenantAwareAuthenticationToken;
import com.procurement.authservice.tenant.TenantContext;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

@Component
@RequiredArgsConstructor
@Slf4j
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtTokenProvider tokenProvider;
    private final TokenBlacklistService tokenBlacklistService;

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        try {
            String jwt = getJwtFromRequest(request);

            if (StringUtils.hasText(jwt) && tokenProvider.validateToken(jwt)
                    && !tokenBlacklistService.isBlacklisted(jwt)
                    && !tokenBlacklistService.isRevokedForUser(jwt)) {
                Long userId = tokenProvider.getUserIdFromToken(jwt);
                String email = tokenProvider.getEmailFromToken(jwt);
                String role = tokenProvider.getRoleFromToken(jwt);
                Long tenantId = tokenProvider.getTenantIdFromToken(jwt);

                List<SimpleGrantedAuthority> authorities = List.of(
                    new SimpleGrantedAuthority("ROLE_" + role.toUpperCase())
                );

                TenantAwareAuthenticationToken authentication =
                    new TenantAwareAuthenticationToken(userId, email, authorities, tenantId);

                SecurityContextHolder.getContext().setAuthentication(authentication);

                if (tenantId != null) {
                    TenantContext.setCurrentTenant(tenantId);
                }
            }
        } catch (Exception ex) {
            log.error("Could not set user authentication in security context", ex);
        }

        try {
            filterChain.doFilter(request, response);
        } finally {
            TenantContext.clear();
        }
    }

    private String getJwtFromRequest(HttpServletRequest request) {
        String bearerToken = request.getHeader("Authorization");
        if (StringUtils.hasText(bearerToken) && bearerToken.startsWith("Bearer ")) {
            return bearerToken.substring(7);
        }
        return null;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getRequestURI();
        return path.startsWith("/api/auth/login")
            || path.startsWith("/api/auth/register")
            || path.startsWith("/api/auth/forgot-password")
            || path.startsWith("/api/auth/reset-password");
    }
}
