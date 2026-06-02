package com.procurement.procurementservice.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.Filter;
import org.hibernate.annotations.FilterDef;
import org.hibernate.annotations.ParamDef;

import java.math.BigDecimal;
import java.time.LocalDate;

@Entity
@Table(name = "PurchaseOrder", indexes = {
    @Index(name = "idx_po_tenant_id", columnList = "tenantId"),
    @Index(name = "idx_po_tenant_status", columnList = "tenantId, status"),
    @Index(name = "idx_po_status", columnList = "status"),
    @Index(name = "idx_po_vendor_id", columnList = "vendorId"),
    @Index(name = "idx_po_created_by", columnList = "createdBy")
})
@FilterDef(name = "tenantFilter", parameters = @ParamDef(name = "tenantId", type = Long.class))
@Filter(name = "tenantFilter", condition = "tenant_id = :tenantId")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class PurchaseOrder {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long poId;

    @Column(nullable = false)
    private Long tenantId;

    private Long rfqId;

    private Long requisitionId;

    private Long bidId;

    private Long vendorId;

    private BigDecimal totalAmount;

    private Long managerId;

    private String status;

    private LocalDate issueDate;

    private LocalDate expectedDeliveryDate;

    private Long approvedBy;

    private LocalDate approvalDate;

    private Long createdBy;

    @Version
    private Long version;
}
