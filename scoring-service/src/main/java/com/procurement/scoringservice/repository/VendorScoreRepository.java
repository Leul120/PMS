package com.procurement.scoringservice.repository;

import com.procurement.scoringservice.entity.VendorScore;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface VendorScoreRepository extends JpaRepository<VendorScore, Long> {
    List<VendorScore> findByVendorId(Long vendorId);
    Optional<VendorScore> findByVendorIdAndPerformanceMetric(Long vendorId, String metric);
    List<VendorScore> findAllByOrderByWeightedScoreDesc();
}
