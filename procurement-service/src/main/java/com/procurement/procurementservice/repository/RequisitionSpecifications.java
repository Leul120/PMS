package com.procurement.procurementservice.repository;

import com.procurement.procurementservice.entity.PurchaseRequisition;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.util.StringUtils;

import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.stream.Collectors;

public final class RequisitionSpecifications {

    private RequisitionSpecifications() {}

    public static Specification<PurchaseRequisition> combine(String search, String status, String statuses) {
        return Specification.where(withSearch(search))
            .and(withStatus(status))
            .and(withStatuses(statuses));
    }

    public static Specification<PurchaseRequisition> withStatus(String status) {
        if (!StringUtils.hasText(status) || "ALL".equalsIgnoreCase(status.trim())) {
            return null;
        }
        String normalized = status.trim();
        return (root, query, cb) -> cb.equal(cb.lower(root.get("status")), normalized.toLowerCase(Locale.ROOT));
    }

    public static Specification<PurchaseRequisition> withStatuses(String statuses) {
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

    public static Specification<PurchaseRequisition> withSearch(String search) {
        if (!StringUtils.hasText(search)) {
            return null;
        }
        String trimmed = search.trim();
        String pattern = "%" + trimmed.toLowerCase(Locale.ROOT) + "%";

        return (root, query, cb) -> {
            var predicates = new java.util.ArrayList<jakarta.persistence.criteria.Predicate>();
            predicates.add(cb.like(cb.lower(root.get("requisitionNumber")), pattern));
            predicates.add(cb.like(cb.lower(root.get("department")), pattern));
            predicates.add(cb.like(cb.lower(root.get("justification")), pattern));
            predicates.add(cb.like(cb.lower(root.get("status")), pattern));
            try {
                long numeric = Long.parseLong(trimmed);
                predicates.add(cb.equal(root.get("requisitionId"), numeric));
            } catch (NumberFormatException ignored) {
                // not numeric
            }
            return cb.or(predicates.toArray(new jakarta.persistence.criteria.Predicate[0]));
        };
    }
}
