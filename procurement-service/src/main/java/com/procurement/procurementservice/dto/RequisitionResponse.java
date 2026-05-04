package com.procurement.procurementservice.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RequisitionResponse {
    private Long requisitionId;
    private String requisitionNumber;
    private Long requesterId;
    private String department;
    private String justification;
    private BigDecimal estimatedBudget;
    private String status;
    private Integer currentApprovalLevel;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private List<RequisitionItemResponse> items;
    private List<ApprovalHistoryResponse> approvalHistory;
}
