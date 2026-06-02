package com.procurement.procurementservice.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.Filter;

import java.time.LocalDateTime;

@Entity
@Table(name = "ApprovalHistory", indexes = {
    @Index(name = "idx_approval_tenant_id", columnList = "tenantId")
})
@Filter(name = "tenantFilter", condition = "tenant_id = :tenantId")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ApprovalHistory {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long approvalId;

    @Column(nullable = false)
    private Long tenantId;

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
