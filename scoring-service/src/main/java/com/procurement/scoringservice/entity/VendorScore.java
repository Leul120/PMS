package com.procurement.scoringservice.entity;

import jakarta.persistence.*;
import lombok.Data;
import java.math.BigDecimal;

@Entity
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
