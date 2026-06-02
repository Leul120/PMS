package com.procurement.rfqbiddingservice.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.Filter;
import org.hibernate.annotations.FilterDef;
import org.hibernate.annotations.ParamDef;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "RFQ", indexes = {
    @Index(name = "idx_rfq_tenant_id", columnList = "tenantId"),
    @Index(name = "idx_rfq_tenant_status", columnList = "tenantId, status"),
    @Index(name = "idx_rfq_status", columnList = "status"),
    @Index(name = "idx_rfq_created_by", columnList = "createdBy"),
    @Index(name = "idx_rfq_deadline_status", columnList = "deadline, status")
})
@FilterDef(name = "tenantFilter", parameters = @ParamDef(name = "tenantId", type = Long.class))
@Filter(name = "tenantFilter", condition = "tenant_id = :tenantId")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class RFQ {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long rfqId;

    @Column(nullable = false)
    private Long tenantId;

    private String title;

    @Column(columnDefinition = "TEXT")
    private String description;

    private LocalDateTime deadline;

    private String status;

    private Long createdBy;

    private LocalDateTime createdAt;

    private BigDecimal estimatedValue;

    private Long categoryId;

    private Integer expectedQuantity;

    /** Links back to the approved purchase requisition that initiated this RFQ. */
    private Long requisitionId;

    @Version
    private Long version;
}
