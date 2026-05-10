package com.procurement.scoringservice.entity;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDate;

@Entity
@Table(name = "vendor_performance_record", indexes = {
    @Index(name = "idx_perf_vendor_id", columnList = "vendorId"),
    @Index(name = "idx_perf_vendor_date", columnList = "vendorId, calculatedDate DESC")
})
@Data
public class VendorPerformanceRecord {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long recordId;
    private Long vendorId;
    private Integer reliabilityScore;
    private Integer qualityScore;
    private Integer costScore;
    private Integer responsivenessScore;
    private LocalDate calculatedDate;
}
