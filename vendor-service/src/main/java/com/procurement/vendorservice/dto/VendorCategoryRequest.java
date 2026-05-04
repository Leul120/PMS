package com.procurement.vendorservice.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class VendorCategoryRequest {
    @NotBlank
    private String categoryName;
    
    private String description;
}
