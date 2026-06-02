package com.procurement.procurementservice.repository;

import com.procurement.procurementservice.entity.PurchaseOrder;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.util.StringUtils;

import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.stream.Collectors;

public final class PurchaseOrderSpecifications {

    private PurchaseOrderSpecifications() {}

    public static Specification<PurchaseOrder> combine(
            String search,
            String status,
            String statuses,
            List<Long> vendorIds) {
        return Specification.where(withSearch(search))
            .and(withStatus(status))
            .and(withStatuses(statuses))
            .and(withVendorIds(vendorIds));
    }

    public static Specification<PurchaseOrder> withStatus(String status) {
        if (!StringUtils.hasText(status) || "ALL".equalsIgnoreCase(status.trim())) {
            return null;
        }
        String normalized = status.trim();
        return (root, query, cb) -> cb.equal(cb.lower(root.get("status")), normalized.toLowerCase(Locale.ROOT));
    }

    public static Specification<PurchaseOrder> withStatuses(String statuses) {
        if (!StringUtils.hasText(statuses)) {
            return null;
        }
        List<String> values = Arrays.stream(statuses.split(","))
            .map(String::trim)
            .filter(StringUtils::hasText)
            .map(s -> s.toLowerCase(Locale.ROOT))
            .collect(Collectors.toList());
        if (values.isEmpty()) {
            return null;
        }
        return (root, query, cb) -> cb.lower(root.get("status")).in(values);
    }

    public static Specification<PurchaseOrder> withVendorIds(List<Long> vendorIds) {
        if (vendorIds == null || vendorIds.isEmpty()) {
            return null;
        }
        return (root, query, cb) -> root.get("vendorId").in(vendorIds);
    }

    public static Specification<PurchaseOrder> withSearch(String search) {
        if (!StringUtils.hasText(search)) {
            return null;
        }
        String trimmed = search.trim();
        String pattern = "%" + trimmed.toLowerCase(Locale.ROOT) + "%";
        Long parsedId = parsePoId(trimmed);

        return (root, query, cb) -> {
            var predicates = new java.util.ArrayList<jakarta.persistence.criteria.Predicate>();
            predicates.add(cb.like(cb.lower(root.get("status")), pattern));
            if (parsedId != null) {
                predicates.add(cb.equal(root.get("poId"), parsedId));
            }
            try {
                long numeric = Long.parseLong(trimmed);
                predicates.add(cb.equal(root.get("poId"), numeric));
                predicates.add(cb.equal(root.get("vendorId"), numeric));
                predicates.add(cb.equal(root.get("rfqId"), numeric));
            } catch (NumberFormatException ignored) {
                // not a bare numeric id
            }
            return cb.or(predicates.toArray(new jakarta.persistence.criteria.Predicate[0]));
        };
    }

    private static Long parsePoId(String search) {
        String upper = search.toUpperCase(Locale.ROOT);
        if (upper.startsWith("PO-")) {
            String digits = upper.substring(3).replaceFirst("^0+", "");
            if (digits.isEmpty()) {
                return null;
            }
            try {
                return Long.parseLong(digits);
            } catch (NumberFormatException e) {
                return null;
            }
        }
        return null;
    }
}
