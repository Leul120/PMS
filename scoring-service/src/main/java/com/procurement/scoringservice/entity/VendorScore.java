package com.procurement.scoringservice.entity;

import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.Filter;
import org.hibernate.annotations.FilterDef;
import org.hibernate.annotations.ParamDef;

import java.math.BigDecimal;

@Entity
@Table(name = "vendor_score", indexes = {
    @Index(name = "idx_vendor_score_tenant_id", columnList = "tenantId"),
    @Index(name = "idx_vendor_score_tenant_vendor", columnList = "tenantId, vendorId"),
    @Index(name = "idx_vendor_score_vendor_id", columnList = "vendorId"),
    @Index(name = "idx_vendor_score_risk_level", columnList = "riskLevel"),
    @Index(name = "idx_vendor_score_vendor_metric", columnList = "vendorId, performanceMetric")
})
@FilterDef(name = "tenantFilter", parameters = @ParamDef(name = "tenantId", type = Long.class))
@Filter(name = "tenantFilter", condition = "tenant_id = :tenantId")
@Data
public class VendorScore {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long scoreId;

    @Column(nullable = false)
    private Long tenantId;

    private Long vendorId;
    private String performanceMetric;
    private BigDecimal weightedScore;
    private String riskLevel;

    @Version
    private Long version;
}
