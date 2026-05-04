package com.procurement.rfqbiddingservice.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "Bid")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Bid {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long bidId;
    
    private Long rfqId;
    
    private Long vendorId;
    
    private BigDecimal bidAmount;
    
    private String status; // "Pending", "Accepted", "Rejected"
    
    private LocalDateTime submittedAt;
    
    private String proposalText;
    
    private Integer deliveryDays;
    
    private BigDecimal qualityScore;
    
    private BigDecimal totalScore;
}
