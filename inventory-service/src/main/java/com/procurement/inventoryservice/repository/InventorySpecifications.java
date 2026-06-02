package com.procurement.inventoryservice.repository;

import com.procurement.inventoryservice.dto.InventoryStockStatus;
import com.procurement.inventoryservice.entity.InventoryItem;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.util.StringUtils;

public final class InventorySpecifications {

    private InventorySpecifications() {}

    public static Specification<InventoryItem> withSearch(String search) {
        if (!StringUtils.hasText(search)) {
            return null;
        }
        String pattern = "%" + search.trim().toLowerCase() + "%";
        return (root, query, cb) -> cb.or(
            cb.like(cb.lower(root.get("name")), pattern),
            cb.like(cb.lower(root.get("itemCode")), pattern),
            cb.like(cb.lower(root.get("category")), pattern),
            cb.like(cb.lower(root.get("location")), pattern),
            cb.like(cb.lower(root.get("unit")), pattern)
        );
    }

    public static Specification<InventoryItem> withCategory(String category) {
        if (!StringUtils.hasText(category)) {
            return null;
        }
        return (root, query, cb) -> cb.equal(root.get("category"), category.trim());
    }

    public static Specification<InventoryItem> withLocation(String location) {
        if (!StringUtils.hasText(location)) {
            return null;
        }
        return (root, query, cb) -> cb.equal(root.get("location"), location.trim());
    }

    public static Specification<InventoryItem> withStockStatus(InventoryStockStatus status) {
        if (status == null || status == InventoryStockStatus.ALL) {
            return null;
        }
        return switch (status) {
            case IN_STOCK -> (root, query, cb) -> cb.and(
                cb.greaterThan(root.get("quantity"), root.get("minStock")),
                cb.lessThanOrEqualTo(root.get("quantity"), root.get("maxStock"))
            );
            case LOW -> (root, query, cb) -> cb.and(
                cb.greaterThan(root.get("quantity"), 0),
                cb.lessThanOrEqualTo(root.get("quantity"), root.get("minStock"))
            );
            case OUT -> (root, query, cb) -> cb.equal(root.get("quantity"), 0);
            case OVER_MAX -> (root, query, cb) -> cb.and(
                cb.greaterThan(root.get("quantity"), root.get("minStock")),
                cb.greaterThan(root.get("quantity"), root.get("maxStock"))
            );
            case NEEDS_ATTENTION -> (root, query, cb) ->
                cb.lessThanOrEqualTo(root.get("quantity"), root.get("minStock"));
            default -> null;
        };
    }

    public static Specification<InventoryItem> combine(
        String search,
        String category,
        String location,
        InventoryStockStatus stockStatus
    ) {
        return Specification.where(withSearch(search))
            .and(withCategory(category))
            .and(withLocation(location))
            .and(withStockStatus(stockStatus));
    }
}
