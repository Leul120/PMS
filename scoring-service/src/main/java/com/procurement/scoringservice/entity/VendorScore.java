package com.procurement.scoringservice.entity;

import jakarta.persistence.*;
import lombok.Data;
import java.math.BigDecimal;

@Entity
@Table(name = "vendor_score", indexes = {
    @Index(name = "idx_vendor_score_vendor_id", columnList = "vendorId"),
    @Index(name = "idx_vendor_score_risk_level", columnList = "riskLevel"),
    @Index(name = "idx_vendor_score_vendor_metric", columnList = "vendorId, performanceMetric")
})
@Data
public class VendorScore {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long scoreId;
    private Long vendorId;
    private String performanceMetric;
    private BigDecimal weightedScore;
    private String riskLevel;
}
