package com.procurement.rfqbiddingservice.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "RFQ", indexes = {
    @Index(name = "idx_rfq_status", columnList = "status"),
    @Index(name = "idx_rfq_created_by", columnList = "createdBy"),
    @Index(name = "idx_rfq_deadline_status", columnList = "deadline, status")
})
@Data
@NoArgsConstructor
@AllArgsConstructor
public class RFQ {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long rfqId;

    private String title;

    @Column(columnDefinition = "TEXT")
    private String description;

    private LocalDateTime deadline;

    private String status; // "Open", "Closed", "Awarded"

    private Long createdBy;

    private LocalDateTime createdAt;

    private BigDecimal estimatedValue;

    private Long categoryId;

    private Integer expectedQuantity;

    /** Optimistic locking — prevents concurrent status changes (e.g. double-close, bid after close). */
    @Version
    private Long version;
}
