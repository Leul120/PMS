package com.procurement.scoringservice.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "ScoringWeights")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ScoringWeights {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long weightId;
    
    private String category; // DEFAULT or specific vendor category
    
    private BigDecimal timelinessWeight; // Default 35%
    
    private BigDecimal qualityWeight; // Default 35%
    
    private BigDecimal costWeight; // Default 20%
    
    private BigDecimal responsivenessWeight; // Default 10%
    
    private LocalDateTime lastUpdated;
    
    private String updatedBy;
}
