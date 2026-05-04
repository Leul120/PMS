package com.procurement.deliveryinvoiceservice.entity;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDate;

@Entity
@Data
public class Delivery {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long deliveryId;
    private Long poId;
    private String deliveryStatus;
    private LocalDate expectedDate;
    private LocalDate actualDate;
    private Integer quantityDelivered;
    private Integer delayDays;
    private String issueNotes;
    private String qualityRemarks;
}
