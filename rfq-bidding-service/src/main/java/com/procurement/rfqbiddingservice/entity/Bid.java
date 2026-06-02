package com.procurement.rfqbiddingservice.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.Filter;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "Bid", indexes = {
    @Index(name = "idx_bid_tenant_id", columnList = "tenantId"),
    @Index(name = "idx_bid_tenant_rfq", columnList = "tenantId, rfqId"),
    @Index(name = "idx_bid_rfq_id", columnList = "rfqId"),
    @Index(name = "idx_bid_vendor_id", columnList = "vendorId"),
    @Index(name = "idx_bid_rfq_score", columnList = "rfqId, totalScore DESC")
})
@Filter(name = "tenantFilter", condition = "tenant_id = :tenantId")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Bid {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long bidId;

    @Column(nullable = false)
    private Long tenantId;

    private Long rfqId;

    private Long vendorId;

    private BigDecimal bidAmount;

    private String status;

    private LocalDateTime submittedAt;

    private String proposalText;

    private Integer deliveryDays;

    private BigDecimal qualityScore;

    private BigDecimal totalScore;

    @Version
    private Long version;
}
