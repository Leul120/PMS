package com.procurement.scoringservice.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.Filter;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "VendorCompositeScore", indexes = {
    @Index(name = "idx_composite_tenant_id", columnList = "tenantId"),
    @Index(name = "idx_composite_tenant_vendor", columnList = "tenantId, vendorId")
})
@Filter(name = "tenantFilter", condition = "tenant_id = :tenantId")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class VendorCompositeScore {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long compositeScoreId;

    @Column(nullable = false)
    private Long tenantId;

    private Long vendorId;
    private BigDecimal timelinessScore;
    private BigDecimal qualityScore;
    private BigDecimal costScore;
    private BigDecimal responsivenessScore;
    private BigDecimal finalWeightedScore;
    private String riskLevel;
    private LocalDateTime calculatedAt;
    private String period;

    @Version
    private Long version;
}
