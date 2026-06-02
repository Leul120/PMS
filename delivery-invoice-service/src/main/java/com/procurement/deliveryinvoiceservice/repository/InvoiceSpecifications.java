package com.procurement.deliveryinvoiceservice.repository;

import com.procurement.deliveryinvoiceservice.entity.Invoice;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.util.StringUtils;

import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.stream.Collectors;

public final class InvoiceSpecifications {

    private InvoiceSpecifications() {}

    public static Specification<Invoice> combine(String search, String status, String statuses, Long vendorId) {
        return Specification.where(withSearch(search))
            .and(withStatus(status))
            .and(withStatuses(statuses))
            .and(withVendorId(vendorId));
    }

    public static Specification<Invoice> withVendorId(Long vendorId) {
        if (vendorId == null) {
            return null;
        }
        return (root, query, cb) -> cb.equal(root.get("vendorId"), vendorId);
    }

    public static Specification<Invoice> withStatus(String status) {
        if (!StringUtils.hasText(status) || "ALL".equalsIgnoreCase(status.trim())) {
            return null;
        }
        String normalized = status.trim();
        return (root, query, cb) -> cb.equal(cb.lower(root.get("status")), normalized.toLowerCase(Locale.ROOT));
    }

    public static Specification<Invoice> withStatuses(String statuses) {
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

    public static Specification<Invoice> withSearch(String search) {
        if (!StringUtils.hasText(search)) {
            return null;
        }
        String trimmed = search.trim();
        String pattern = "%" + trimmed.toLowerCase(Locale.ROOT) + "%";

        return (root, query, cb) -> {
            var predicates = new java.util.ArrayList<jakarta.persistence.criteria.Predicate>();
            predicates.add(cb.like(cb.lower(root.get("status")), pattern));
            predicates.add(cb.like(cb.lower(cb.coalesce(root.get("discrepancyReason"), "")), pattern));
            Long parsedId = parseInvoiceId(trimmed);
            if (parsedId != null) {
                predicates.add(cb.equal(root.get("invoiceId"), parsedId));
            }
            try {
                long numeric = Long.parseLong(trimmed);
                predicates.add(cb.equal(root.get("invoiceId"), numeric));
                predicates.add(cb.equal(root.get("poId"), numeric));
                predicates.add(cb.equal(root.get("vendorId"), numeric));
            } catch (NumberFormatException ignored) {
                // not numeric
            }
            return cb.or(predicates.toArray(new jakarta.persistence.criteria.Predicate[0]));
        };
    }

    private static Long parseInvoiceId(String search) {
        String upper = search.toUpperCase(Locale.ROOT);
        if (upper.startsWith("INV-") || upper.startsWith("INVOICE-")) {
            String prefix = upper.startsWith("INV-") ? "INV-" : "INVOICE-";
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
