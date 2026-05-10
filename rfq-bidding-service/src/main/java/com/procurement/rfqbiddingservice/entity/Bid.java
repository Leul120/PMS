package com.procurement.rfqbiddingservice.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "Bid", indexes = {
    @Index(name = "idx_bid_rfq_id", columnList = "rfqId"),
    @Index(name = "idx_bid_vendor_id", columnList = "vendorId"),
    @Index(name = "idx_bid_rfq_score", columnList = "rfqId, totalScore DESC")
})
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

    private String status; // "Pending", "Accepted", "Rejected", "Awarded"

    private LocalDateTime submittedAt;

    private String proposalText;

    private Integer deliveryDays;

    private BigDecimal qualityScore;

    private BigDecimal totalScore;

    /** Optimistic locking — prevents concurrent bid status updates. */
    @Version
    private Long version;
}
