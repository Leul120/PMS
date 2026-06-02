package com.procurement.scoringservice.entity;

import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.Filter;

import java.time.LocalDate;

@Entity
@Table(name = "vendor_performance_record", indexes = {
    @Index(name = "idx_perf_tenant_id", columnList = "tenantId"),
    @Index(name = "idx_perf_tenant_vendor", columnList = "tenantId, vendorId"),
    @Index(name = "idx_perf_vendor_id", columnList = "vendorId"),
    @Index(name = "idx_perf_vendor_date", columnList = "vendorId, calculatedDate DESC")
})
@Filter(name = "tenantFilter", condition = "tenant_id = :tenantId")
@Data
public class VendorPerformanceRecord {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long recordId;

    @Column(nullable = false)
    private Long tenantId;

    private Long vendorId;
    private Integer reliabilityScore;
    private Integer qualityScore;
    private Integer costScore;
    private Integer responsivenessScore;
    private LocalDate calculatedDate;

    @Version
    private Long version;
}
