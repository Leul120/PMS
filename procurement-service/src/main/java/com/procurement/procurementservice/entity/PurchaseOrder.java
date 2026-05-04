package com.procurement.procurementservice.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;

@Entity
@Table(name = "PurchaseOrder")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class PurchaseOrder {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long poId;
    
    private Long rfqId;
    
    private Long vendorId;
    
    private BigDecimal totalAmount;
    
    private Long managerId;
    
    private String status; // "Draft", "Pending Approval", "Approved", "Dispatched", "Closed"
    
    private LocalDate issueDate;
    
    private LocalDate expectedDeliveryDate;
    
    private Long approvedBy;
    
    private LocalDate approvalDate;
    
    private Long createdBy;
}
