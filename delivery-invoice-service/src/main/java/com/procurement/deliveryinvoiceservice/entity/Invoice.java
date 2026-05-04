package com.procurement.deliveryinvoiceservice.entity;

import jakarta.persistence.*;
import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDate;

@Entity
@Data
public class Invoice {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long invoiceId;
    private Long poId;
    private BigDecimal invoiceAmount;
    private String status;
    private LocalDate invoiceDate;
    private Boolean discrepancyFlag;
    private String discrepancyReason;
}
