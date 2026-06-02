package com.procurement.procurementservice.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.Filter;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Entity
@Table(name = "PurchaseRequisition", indexes = {
    @Index(name = "idx_pr_tenant_id", columnList = "tenantId"),
    @Index(name = "idx_pr_tenant_status", columnList = "tenantId, status"),
    @Index(name = "idx_pr_requester_id", columnList = "requesterId")
})
@Filter(name = "tenantFilter", condition = "tenant_id = :tenantId")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class PurchaseRequisition {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long requisitionId;

    @Column(nullable = false)
    private Long tenantId;

    private String requisitionNumber;

    private Long requesterId;

    private String department;

    private String justification;

    private BigDecimal estimatedBudget;

    private String status;

    private Integer currentApprovalLevel;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    @OneToMany(mappedBy = "requisition", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private List<RequisitionItem> items;

    @OneToMany(mappedBy = "requisition", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private List<ApprovalHistory> approvalHistory;
}
