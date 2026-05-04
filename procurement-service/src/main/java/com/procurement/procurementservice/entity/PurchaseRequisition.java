package com.procurement.procurementservice.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Entity
@Table(name = "PurchaseRequisition")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class PurchaseRequisition {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long requisitionId;
    
    private String requisitionNumber;
    
    private Long requesterId;
    
    private String department;
    
    private String justification;
    
    private BigDecimal estimatedBudget;
    
    private String status; // DRAFT, PENDING_APPROVAL, APPROVED, REJECTED, CONVERTED_TO_PO
    
    private Integer currentApprovalLevel;
    
    private LocalDateTime createdAt;
    
    private LocalDateTime updatedAt;
    
    @OneToMany(mappedBy = "requisition", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private List<RequisitionItem> items;
    
    @OneToMany(mappedBy = "requisition", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private List<ApprovalHistory> approvalHistory;
}
