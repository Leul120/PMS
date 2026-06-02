package com.procurement.inventoryservice.dto;

/**
 * Stock-level filters aligned with {@link com.procurement.inventoryservice.entity.InventoryItem#getStatus()}.
 */
public enum InventoryStockStatus {
    ALL,
    IN_STOCK,
    LOW,
    OUT,
    OVER_MAX,
    NEEDS_ATTENTION
}
