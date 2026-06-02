package com.procurement.inventoryservice.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.Filter;
import org.hibernate.annotations.FilterDef;
import org.hibernate.annotations.ParamDef;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "inventory_items", indexes = {
    @Index(name = "idx_inventory_tenant_id", columnList = "tenantId"),
    @Index(name = "idx_inventory_tenant_code", columnList = "tenantId, itemCode"),
    @Index(name = "idx_inventory_item_code", columnList = "itemCode"),
    @Index(name = "idx_inventory_category", columnList = "category"),
    @Index(name = "idx_inventory_quantity", columnList = "quantity")
})
@FilterDef(name = "tenantFilter", parameters = @ParamDef(name = "tenantId", type = Long.class))
@Filter(name = "tenantFilter", condition = "tenant_id = :tenantId")
@Data
public class InventoryItem {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long tenantId;

    @Column(nullable = false, unique = true)
    @NotBlank(message = "Item code is required")
    private String itemCode;

    @Column(nullable = false)
    @NotBlank(message = "Name is required")
    private String name;

    private String description;

    @Column(nullable = false)
    @NotNull(message = "Quantity is required")
    @Min(value = 0, message = "Quantity cannot be negative")
    private Integer quantity;

    @Column(nullable = false)
    @NotNull(message = "Minimum stock level is required")
    @Min(value = 0, message = "Min stock cannot be negative")
    private Integer minStock;

    @Column(nullable = false)
    @NotNull(message = "Maximum stock level is required")
    @Min(value = 1, message = "Max stock must be at least 1")
    private Integer maxStock;

    private String unit;
    private String location;
    private String category;

    @CreationTimestamp
    private LocalDateTime createdAt;

    @UpdateTimestamp
    private LocalDateTime updatedAt;

    public String getStatus() {
        if (quantity <= 0) return "critical";
        if (quantity <= minStock) return "low";
        return "normal";
    }
}
