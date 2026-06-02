package com.procurement.authservice.repository;

import com.procurement.authservice.entity.User;
import jakarta.persistence.criteria.Join;
import jakarta.persistence.criteria.JoinType;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.util.StringUtils;

import java.util.Locale;

public final class UserSpecifications {

    private UserSpecifications() {}

    public static Specification<User> combine(
            String search,
            String role,
            String accountStatus,
            Long tenantId) {
        return Specification.where(withSearch(search))
            .and(withRole(role))
            .and(withAccountStatus(accountStatus))
            .and(withTenantId(tenantId));
    }

    public static Specification<User> withTenantId(Long tenantId) {
        if (tenantId == null) {
            return null;
        }
        return (root, query, cb) -> cb.equal(root.get("tenant").get("tenantId"), tenantId);
    }

    public static Specification<User> withRole(String role) {
        if (!StringUtils.hasText(role) || "ALL".equalsIgnoreCase(role.trim())) {
            return null;
        }
        String normalized = role.trim();
        return (root, query, cb) -> {
            Join<Object, Object> roleJoin = root.join("role", JoinType.LEFT);
            return cb.equal(cb.upper(roleJoin.get("roleName")), normalized.toUpperCase(Locale.ROOT));
        };
    }

    public static Specification<User> withAccountStatus(String accountStatus) {
        if (!StringUtils.hasText(accountStatus) || "ALL".equalsIgnoreCase(accountStatus.trim())) {
            return null;
        }
        return switch (accountStatus.trim().toUpperCase(Locale.ROOT)) {
            case "ACTIVE" -> (root, query, cb) -> cb.and(
                cb.or(cb.isFalse(root.get("accountLocked")), cb.isNull(root.get("accountLocked"))),
                cb.or(cb.isFalse(root.get("deactivated")), cb.isNull(root.get("deactivated")))
            );
            case "LOCKED" -> (root, query, cb) -> cb.isTrue(root.get("accountLocked"));
            case "INACTIVE" -> (root, query, cb) -> cb.isTrue(root.get("deactivated"));
            default -> null;
        };
    }

    public static Specification<User> withSearch(String search) {
        if (!StringUtils.hasText(search)) {
            return null;
        }
        String trimmed = search.trim();
        String pattern = "%" + trimmed.toLowerCase(Locale.ROOT) + "%";

        return (root, query, cb) -> {
            Join<Object, Object> roleJoin = root.join("role", JoinType.LEFT);
            Join<Object, Object> tenantJoin = root.join("tenant", JoinType.LEFT);
            var predicates = new java.util.ArrayList<jakarta.persistence.criteria.Predicate>();
            predicates.add(cb.like(cb.lower(root.get("fullName")), pattern));
            predicates.add(cb.like(cb.lower(root.get("email")), pattern));
            predicates.add(cb.like(cb.lower(cb.coalesce(root.get("phoneNumber"), "")), pattern));
            predicates.add(cb.like(cb.lower(cb.coalesce(root.get("companyName"), "")), pattern));
            predicates.add(cb.like(cb.lower(roleJoin.get("roleName")), pattern));
            predicates.add(cb.like(cb.lower(tenantJoin.get("name")), pattern));
            predicates.add(cb.like(cb.lower(tenantJoin.get("domain")), pattern));
            try {
                long numeric = Long.parseLong(trimmed);
                predicates.add(cb.equal(root.get("userId"), numeric));
            } catch (NumberFormatException ignored) {
                // not numeric
            }
            return cb.or(predicates.toArray(new jakarta.persistence.criteria.Predicate[0]));
        };
    }
}
