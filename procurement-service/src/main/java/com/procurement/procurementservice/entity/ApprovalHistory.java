package com.procurement.procurementservice.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "ApprovalHistory")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ApprovalHistory {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long approvalId;
    
    @ManyToOne
    @JoinColumn(name = "requisitionId")
    private PurchaseRequisition requisition;
    
    private Long approverId;
    
    private String approverRole; // DEPARTMENT_HEAD, MANAGER, DIRECTOR
    
    private Integer approvalLevel;
    
    private String decision; // APPROVED, REJECTED
    
    private String comments;
    
    private LocalDateTime approvedAt;
}
