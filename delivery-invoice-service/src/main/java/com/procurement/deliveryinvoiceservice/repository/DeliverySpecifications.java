package com.procurement.deliveryinvoiceservice.repository;

import com.procurement.deliveryinvoiceservice.entity.Delivery;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.util.StringUtils;

import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.stream.Collectors;

public final class DeliverySpecifications {

    private DeliverySpecifications() {}

    public static Specification<Delivery> combine(String search, String status, String statuses) {
        return Specification.where(withSearch(search))
            .and(withStatus(status))
            .and(withStatuses(statuses));
    }

    public static Specification<Delivery> withStatus(String status) {
        if (!StringUtils.hasText(status) || "ALL".equalsIgnoreCase(status.trim())) {
            return null;
        }
        return withStatuses(normalizeDeliveryStatus(status.trim()));
    }

    public static Specification<Delivery> withStatuses(String statuses) {
        if (!StringUtils.hasText(statuses)) {
            return null;
        }
        List<String> values = Arrays.stream(statuses.split(","))
            .map(String::trim)
            .filter(StringUtils::hasText)
            .map(DeliverySpecifications::normalizeDeliveryStatus)
            .flatMap(s -> Arrays.stream(s.split("\\|")))
            .map(s -> s.toLowerCase(Locale.ROOT))
            .distinct()
            .collect(Collectors.toList());
        if (values.isEmpty()) {
            return null;
        }
        return (root, query, cb) -> cb.lower(root.get("deliveryStatus")).in(values);
    }

    public static Specification<Delivery> withSearch(String search) {
        if (!StringUtils.hasText(search)) {
            return null;
        }
        String trimmed = search.trim();
        String pattern = "%" + trimmed.toLowerCase(Locale.ROOT) + "%";

        return (root, query, cb) -> {
            var predicates = new java.util.ArrayList<jakarta.persistence.criteria.Predicate>();
            predicates.add(cb.like(cb.lower(root.get("deliveryStatus")), pattern));
            predicates.add(cb.like(cb.lower(cb.coalesce(root.get("issueNotes"), "")), pattern));
            predicates.add(cb.like(cb.lower(cb.coalesce(root.get("qualityRemarks"), "")), pattern));
            Long parsedId = parseDeliveryId(trimmed);
            if (parsedId != null) {
                predicates.add(cb.equal(root.get("deliveryId"), parsedId));
            }
            try {
                long numeric = Long.parseLong(trimmed);
                predicates.add(cb.equal(root.get("deliveryId"), numeric));
                predicates.add(cb.equal(root.get("poId"), numeric));
            } catch (NumberFormatException ignored) {
                // not numeric
            }
            return cb.or(predicates.toArray(new jakarta.persistence.criteria.Predicate[0]));
        };
    }

    private static String normalizeDeliveryStatus(String status) {
        return switch (status.toUpperCase(Locale.ROOT)) {
            case "SHIPPED" -> "Shipped";
            case "IN_TRANSIT", "IN TRANSIT", "INTRANSIT" -> "In Transit";
            case "DELIVERED" -> "Delivered";
            case "PENDING" -> "Pending";
            case "CANCELLED", "CANCELED" -> "Cancelled";
            default -> status;
        };
    }

    private static Long parseDeliveryId(String search) {
        String upper = search.toUpperCase(Locale.ROOT);
        if (upper.startsWith("DEL-") || upper.startsWith("DELIVERY-")) {
            String prefix = upper.startsWith("DEL-") ? "DEL-" : "DELIVERY-";
            String digits = upper.substring(prefix.length()).replaceFirst("^0+", "");
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
