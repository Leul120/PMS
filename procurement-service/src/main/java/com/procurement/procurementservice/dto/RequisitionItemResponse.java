package com.procurement.procurementservice.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RequisitionItemResponse {
    private Long itemId;
    private String itemName;
    private String description;
    private Integer quantity;
    private String unit;
    private BigDecimal estimatedUnitPrice;
    private String category;
}
