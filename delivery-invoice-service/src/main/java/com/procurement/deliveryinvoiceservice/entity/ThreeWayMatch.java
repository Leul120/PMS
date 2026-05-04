package com.procurement.deliveryinvoiceservice.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "ThreeWayMatch")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ThreeWayMatch {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long matchId;
    
    private Long poId;
    
    private Long deliveryId;
    
    private Long invoiceId;
    
    private BigDecimal poAmount;
    
    private Integer poQuantity;
    
    private BigDecimal invoiceAmount;
    
    private Integer deliveryQuantity;
    
    private Boolean quantityMatch;
    
    private Boolean priceMatch;
    
    private String status; // MATCHED, MISMATCH, PENDING
    
    private String mismatchReason;
    
    private LocalDateTime validatedAt;
}
