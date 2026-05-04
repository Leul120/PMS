package com.procurement.vendorservice.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class VendorCategoryResponse {
    private Long categoryId;
    private String categoryName;
    private String description;
}
