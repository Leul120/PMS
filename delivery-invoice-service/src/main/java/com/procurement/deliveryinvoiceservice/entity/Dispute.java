package com.procurement.deliveryinvoiceservice.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "Dispute")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Dispute {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long disputeId;
    
    private Long poId;
    
    private Long deliveryId;
    
    private Long invoiceId;
    
    private Long raisedBy; // User ID
    
    private String raisedByRole; // VENDOR, PROCUREMENT_OFFICER
    
    private String disputeType; // QUANTITY_MISMATCH, PRICE_MISMATCH, QUALITY_ISSUE, DELAYED_DELIVERY
    
    private String description;
    
    private String status; // OPEN, UNDER_REVIEW, RESOLVED, CLOSED
    
    private String resolution;
    
    private Long resolvedBy;
    
    private LocalDateTime raisedAt;
    
    private LocalDateTime resolvedAt;
}
