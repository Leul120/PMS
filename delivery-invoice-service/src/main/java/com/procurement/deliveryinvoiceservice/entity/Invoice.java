package com.procurement.deliveryinvoiceservice.entity;

import jakarta.persistence.*;
import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDate;

@Entity
@Table(name = "invoice", indexes = {
    @Index(name = "idx_invoice_po_id", columnList = "poId"),
    @Index(name = "idx_invoice_vendor_id", columnList = "vendorId"),
    @Index(name = "idx_invoice_status", columnList = "status"),
    @Index(name = "idx_invoice_discrepancy", columnList = "discrepancyFlag")
})
@Data
public class Invoice {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long invoiceId;
    private Long poId;
    private Long vendorId;
    private BigDecimal invoiceAmount;
    private String status;
    private LocalDate invoiceDate;
    private Boolean discrepancyFlag;
    private String discrepancyReason;
}
