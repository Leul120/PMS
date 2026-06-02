package com.procurement.authservice.repository;

import com.procurement.authservice.entity.Tenant;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.util.StringUtils;

import java.util.Locale;

public final class TenantSpecifications {

    private TenantSpecifications() {}

    public static Specification<Tenant> combine(String search, String status) {
        return Specification.where(withSearch(search))
            .and(withStatus(status));
    }

    public static Specification<Tenant> withStatus(String status) {
        if (!StringUtils.hasText(status) || "ALL".equalsIgnoreCase(status.trim())) {
            return null;
        }
        try {
            Tenant.TenantStatus tenantStatus = Tenant.TenantStatus.valueOf(status.trim().toUpperCase(Locale.ROOT));
            return (root, query, cb) -> cb.equal(root.get("status"), tenantStatus);
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    public static Specification<Tenant> withSearch(String search) {
        if (!StringUtils.hasText(search)) {
            return null;
        }
        String trimmed = search.trim();
        String pattern = "%" + trimmed.toLowerCase(Locale.ROOT) + "%";

        return (root, query, cb) -> cb.or(
            cb.like(cb.lower(root.get("name")), pattern),
            cb.like(cb.lower(root.get("domain")), pattern)
        );
    }
}
