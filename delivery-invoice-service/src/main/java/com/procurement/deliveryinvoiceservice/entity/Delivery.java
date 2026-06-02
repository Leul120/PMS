package com.procurement.deliveryinvoiceservice.entity;

import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.Filter;
import org.hibernate.annotations.FilterDef;
import org.hibernate.annotations.ParamDef;

import java.time.LocalDate;

@Entity
@Table(name = "delivery", indexes = {
    @Index(name = "idx_delivery_tenant_id", columnList = "tenantId"),
    @Index(name = "idx_delivery_tenant_po", columnList = "tenantId, poId"),
    @Index(name = "idx_delivery_po_id", columnList = "poId"),
    @Index(name = "idx_delivery_status", columnList = "deliveryStatus"),
    @Index(name = "idx_delivery_po_status", columnList = "poId, deliveryStatus")
})
@FilterDef(name = "tenantFilter", parameters = @ParamDef(name = "tenantId", type = Long.class))
@Filter(name = "tenantFilter", condition = "tenant_id = :tenantId")
@Data
public class Delivery {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long deliveryId;

    @Column(nullable = false)
    private Long tenantId;

    private Long poId;
    private String deliveryStatus;
    private LocalDate expectedDate;
    private LocalDate actualDate;
    private Integer quantityDelivered;
    private Integer delayDays;
    private String issueNotes;
    /** Audit-only narrative; not used for scoring when qualityRating is set. */
    private String qualityRemarks;
    /** ACCEPTED | ACCEPTED_WITH_ISSUES | REJECTED */
    private String qualityRating;
    /** Comma-separated: DAMAGED, SHORT_SHIP, WRONG_ITEM, WRONG_SPEC, PACKAGING */
    private String qualityIssueTypes;
    /** Optional PO line qty for short-ship scoring */
    private Integer quantityOrdered;
}
