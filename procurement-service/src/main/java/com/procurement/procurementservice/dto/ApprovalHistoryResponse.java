package com.procurement.procurementservice.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ApprovalHistoryResponse {
    private Long approvalId;
    private Long approverId;
    private String approverRole;
    private Integer approvalLevel;
    private String decision;
    private String comments;
    private LocalDateTime approvedAt;
}
