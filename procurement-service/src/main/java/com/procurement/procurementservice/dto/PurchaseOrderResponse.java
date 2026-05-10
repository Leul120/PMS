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
    // Alias for frontend compatibility
    private Long id;
    private String poNumber;
    private Long rfqId;
    private Long vendorId;
    private String vendorName;
    private BigDecimal totalAmount;
    private Long managerId;
    private String status;
    private LocalDate issueDate;
    // Alias for frontend compatibility
    private LocalDate createdAt;
    private LocalDate expectedDeliveryDate;
    // Alias for frontend compatibility
    private LocalDate deliveryDate;
    private Long approvedBy;
    private LocalDate approvalDate;
}
