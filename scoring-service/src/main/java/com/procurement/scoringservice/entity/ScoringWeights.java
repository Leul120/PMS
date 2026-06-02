package com.procurement.scoringservice.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.Filter;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "ScoringWeights", indexes = {
    @Index(name = "idx_scoring_weights_tenant_id", columnList = "tenantId")
})
@Filter(name = "tenantFilter", condition = "tenant_id = :tenantId")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ScoringWeights {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long weightId;

    @Column(nullable = false)
    private Long tenantId;

    private String category;
    private BigDecimal timelinessWeight;
    private BigDecimal qualityWeight;
    private BigDecimal costWeight;
    private BigDecimal responsivenessWeight;
    private LocalDateTime lastUpdated;
    private String updatedBy;
}
