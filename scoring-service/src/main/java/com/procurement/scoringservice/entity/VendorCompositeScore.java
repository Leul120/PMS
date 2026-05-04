package com.procurement.scoringservice.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "VendorCompositeScore")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class VendorCompositeScore {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long compositeScoreId;
    
    private Long vendorId;
    
    private BigDecimal timelinessScore;
    
    private BigDecimal qualityScore;
    
    private BigDecimal costScore;
    
    private BigDecimal responsivenessScore;
    
    private BigDecimal finalWeightedScore;
    
    private String riskLevel; // LOW (>=80), MEDIUM (60-80), HIGH (<60)
    
    private LocalDateTime calculatedAt;
    
    private String period; // Monthly/Quarterly period identifier
}
