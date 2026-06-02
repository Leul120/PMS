package com.procurement.vendorservice.repository;

import com.procurement.vendorservice.entity.Vendor;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.util.StringUtils;

import java.util.Locale;

public final class VendorSpecifications {

    private VendorSpecifications() {}

    public static Specification<Vendor> combine(String search, String status) {
        return Specification.where(withSearch(search))
            .and(withStatus(status));
    }

    public static Specification<Vendor> withStatus(String status) {
        if (!StringUtils.hasText(status) || "ALL".equalsIgnoreCase(status.trim())) {
            return null;
        }
        return switch (status.trim().toUpperCase(Locale.ROOT)) {
            case "ACTIVE" -> (root, query, cb) ->
                cb.equal(cb.lower(root.get("complianceStatus")), "verified");
            case "PENDING" -> (root, query, cb) -> cb.and(
                cb.notEqual(cb.lower(root.get("complianceStatus")), "verified"),
                cb.not(cb.lower(root.get("complianceStatus")).in("inactive", "suspended"))
            );
            case "INACTIVE" -> (root, query, cb) ->
                cb.lower(root.get("complianceStatus")).in("inactive", "suspended");
            default -> (root, query, cb) ->
                cb.equal(cb.lower(root.get("complianceStatus")), status.trim().toLowerCase(Locale.ROOT));
        };
    }

    public static Specification<Vendor> withSearch(String search) {
        if (!StringUtils.hasText(search)) {
            return null;
        }
        String trimmed = search.trim();
        String pattern = "%" + trimmed.toLowerCase(Locale.ROOT) + "%";

        return (root, query, cb) -> {
            var predicates = new java.util.ArrayList<jakarta.persistence.criteria.Predicate>();
            predicates.add(cb.like(cb.lower(root.get("companyName")), pattern));
            predicates.add(cb.like(cb.lower(root.get("email")), pattern));
            predicates.add(cb.like(cb.lower(cb.coalesce(root.get("contactPerson"), "")), pattern));
            predicates.add(cb.like(cb.lower(cb.coalesce(root.get("phoneNumber"), "")), pattern));
            predicates.add(cb.like(cb.lower(cb.coalesce(root.get("taxId"), "")), pattern));
            try {
                long numeric = Long.parseLong(trimmed);
                predicates.add(cb.equal(root.get("vendorId"), numeric));
            } catch (NumberFormatException ignored) {
                // not numeric
            }
            return cb.or(predicates.toArray(new jakarta.persistence.criteria.Predicate[0]));
        };
    }
}
