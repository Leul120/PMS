package com.procurement.inventoryservice.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

/**
 * DTO for creating/updating inventory items.
 * Prevents mass-assignment of internal fields (id, createdAt, updatedAt).
 */
@Data
public class InventoryItemRequest {

    @NotBlank(message = "Item code is required")
    private String itemCode;

    @NotBlank(message = "Name is required")
    private String name;

    private String description;

    @NotNull(message = "Quantity is required")
    @Min(value = 0, message = "Quantity cannot be negative")
    private Integer quantity;

    @NotNull(message = "Minimum stock level is required")
    @Min(value = 0, message = "Min stock cannot be negative")
    private Integer minStock;

    @NotNull(message = "Maximum stock level is required")
    @Min(value = 1, message = "Max stock must be at least 1")
    private Integer maxStock;

    private String unit;
    private String location;
    private String category;
}
