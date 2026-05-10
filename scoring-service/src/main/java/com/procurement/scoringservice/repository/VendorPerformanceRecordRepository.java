package com.procurement.scoringservice.repository;

import com.procurement.scoringservice.entity.VendorPerformanceRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface VendorPerformanceRecordRepository extends JpaRepository<VendorPerformanceRecord, Long> {
    Optional<VendorPerformanceRecord> findTopByVendorIdOrderByCalculatedDateDesc(Long vendorId);
    List<VendorPerformanceRecord> findTop5ByVendorIdOrderByCalculatedDateDesc(Long vendorId);
}
