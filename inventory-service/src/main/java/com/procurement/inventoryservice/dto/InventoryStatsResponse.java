package com.procurement.inventoryservice.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class InventoryStatsResponse {
    private long productCount;
    private long totalUnits;
    private long inStock;
    private long lowStock;
    private long outOfStock;
    private long overMax;
}
