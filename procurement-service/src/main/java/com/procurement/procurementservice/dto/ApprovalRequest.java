package com.procurement.procurementservice.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class ApprovalRequest {
    @NotBlank
    private String decision; // APPROVED, REJECTED
    
    private String comments;
}
