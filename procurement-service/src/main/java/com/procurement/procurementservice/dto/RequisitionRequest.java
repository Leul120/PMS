package com.procurement.procurementservice.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;
import java.util.List;

@Data
public class RequisitionRequest {
    @NotBlank
    private String department;
    
    private String justification;
    
    @NotNull
    private BigDecimal estimatedBudget;
    
    @NotEmpty
    @Valid
    private List<RequisitionItemRequest> items;
}
