package com.procurement.procurementservice.infrastructure.client;

import org.springframework.util.StringUtils;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;
import org.springframework.web.reactive.function.client.WebClient;

import jakarta.servlet.http.HttpServletRequest;

/**
 * Forwards the inbound user JWT (and tenant header) to downstream service calls.
 * Must be applied on the servlet thread before {@code .retrieve().block()}.
 */
public final class OutboundAuthFilter {

    private OutboundAuthFilter() {}

    @SuppressWarnings("unchecked")
    public static <T extends WebClient.RequestHeadersSpec<?>> T apply(T spec) {
        ServletRequestAttributes attrs =
            (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
        if (attrs == null) {
            return spec;
        }

        HttpServletRequest incoming = attrs.getRequest();

        String authorization = incoming.getHeader("Authorization");
        if (StringUtils.hasText(authorization)) {
            spec = (T) spec.header("Authorization", authorization);
        }

        String tenantId = incoming.getHeader("X-Tenant-ID");
        if (StringUtils.hasText(tenantId)) {
            spec = (T) spec.header("X-Tenant-ID", tenantId);
        }

        return spec;
    }
}
