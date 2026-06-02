package com.procurement.authservice.tenant;

import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.GrantedAuthority;

import java.util.Collection;

/**
 * Authentication token that carries the tenant ID alongside the standard credentials.
 */
public class TenantAwareAuthenticationToken extends UsernamePasswordAuthenticationToken {

    private final Long tenantId;

    public TenantAwareAuthenticationToken(Object principal, Object credentials,
                                           Collection<? extends GrantedAuthority> authorities,
                                           Long tenantId) {
        super(principal, credentials, authorities);
        this.tenantId = tenantId;
    }

    public Long getTenantId() {
        return tenantId;
    }
}
