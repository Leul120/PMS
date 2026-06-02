package com.procurement.rfqbiddingservice.repository;

import com.procurement.rfqbiddingservice.entity.RFQ;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.util.StringUtils;

import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.stream.Collectors;

public final class RFQSpecifications {

    private RFQSpecifications() {}

    public static Specification<RFQ> combine(
            String search,
            String status,
            String statuses,
            Long categoryId) {
        return Specification.where(withSearch(search))
            .and(withStatus(status))
            .and(withStatuses(statuses))
            .and(withCategoryId(categoryId));
    }

    public static Specification<RFQ> withCategoryId(Long categoryId) {
        if (categoryId == null) {
            return null;
        }
        return (root, query, cb) -> cb.equal(root.get("categoryId"), categoryId);
    }

    public static Specification<RFQ> withStatus(String status) {
        if (!StringUtils.hasText(status) || "ALL".equalsIgnoreCase(status.trim())) {
            return null;
        }
        String normalized = status.trim();
        return (root, query, cb) -> cb.equal(cb.lower(root.get("status")), normalized.toLowerCase(Locale.ROOT));
    }

    public static Specification<RFQ> withStatuses(String statuses) {
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

    public static Specification<RFQ> withSearch(String search) {
        if (!StringUtils.hasText(search)) {
            return null;
        }
        String trimmed = search.trim();
        String pattern = "%" + trimmed.toLowerCase(Locale.ROOT) + "%";

        return (root, query, cb) -> {
            var predicates = new java.util.ArrayList<jakarta.persistence.criteria.Predicate>();
            predicates.add(cb.like(cb.lower(root.get("title")), pattern));
            predicates.add(cb.like(cb.lower(cb.coalesce(root.get("description"), "")), pattern));
            predicates.add(cb.like(cb.lower(root.get("status")), pattern));
            Long parsedId = parseRfqId(trimmed);
            if (parsedId != null) {
                predicates.add(cb.equal(root.get("rfqId"), parsedId));
            }
            try {
                long numeric = Long.parseLong(trimmed);
                predicates.add(cb.equal(root.get("rfqId"), numeric));
            } catch (NumberFormatException ignored) {
                // not numeric
            }
            return cb.or(predicates.toArray(new jakarta.persistence.criteria.Predicate[0]));
        };
    }

    private static Long parseRfqId(String search) {
        String upper = search.toUpperCase(Locale.ROOT);
        if (upper.startsWith("RFQ-")) {
            String digits = upper.substring(4).replaceFirst("^0+", "");
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
