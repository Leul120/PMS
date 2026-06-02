package com.procurement.authservice.infrastructure.cache;

import com.procurement.authservice.tenant.TenantContext;
import org.springframework.cache.interceptor.KeyGenerator;
import org.springframework.stereotype.Component;

import java.lang.reflect.Method;
import java.util.Arrays;
import java.util.stream.Collectors;

/**
 * Cache key generator that prefixes all keys with the current tenantId.
 * Keys take the form:  "tenant:{id}:{className}.{methodName}:{args...}"
 * Falls back to plain key when no tenant context is set (e.g. system-level calls).
 */
@Component("tenantAwareCacheKeyGenerator")
public class TenantAwareCacheKeyGenerator implements KeyGenerator {

    @Override
    public Object generate(Object target, Method method, Object... params) {
        Long tenantId = TenantContext.getCurrentTenant();
        String paramString = Arrays.stream(params)
            .map(p -> p == null ? "null" : p.toString())
            .collect(Collectors.joining(","));

        String baseKey = target.getClass().getSimpleName() + "." + method.getName() + ":" + paramString;

        return tenantId != null ? "tenant:" + tenantId + ":" + baseKey : baseKey;
    }

    public static String tenantKey(String key) {
        Long tenantId = TenantContext.getCurrentTenant();
        return tenantId != null ? "tenant:" + tenantId + ":" + key : key;
    }
}
