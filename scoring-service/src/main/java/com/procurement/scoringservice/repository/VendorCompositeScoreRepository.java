package com.procurement.scoringservice.repository;

import com.procurement.scoringservice.entity.VendorCompositeScore;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

@Repository
public interface VendorCompositeScoreRepository extends JpaRepository<VendorCompositeScore, Long> {
    Optional<VendorCompositeScore> findByVendorId(Long vendorId);
    List<VendorCompositeScore> findByRiskLevel(String riskLevel);
    List<VendorCompositeScore> findByFinalWeightedScoreGreaterThanEqual(BigDecimal score);
    List<VendorCompositeScore> findByFinalWeightedScoreBetween(BigDecimal min, BigDecimal max);
}
