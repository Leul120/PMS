package com.procurement.procurementservice.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PurchaseOrderResponse {
    private Long poId;
    private Long rfqId;
    private Long vendorId;
    private BigDecimal totalAmount;
    private Long managerId;
    private String status;
    private LocalDate issueDate;
    private LocalDate expectedDeliveryDate;
    private Long approvedBy;
    private LocalDate approvalDate;
}
