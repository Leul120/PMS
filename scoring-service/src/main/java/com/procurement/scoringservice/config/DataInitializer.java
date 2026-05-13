package com.procurement.scoringservice.config;

import com.procurement.scoringservice.entity.ScoringWeights;
import com.procurement.scoringservice.entity.VendorCompositeScore;
import com.procurement.scoringservice.entity.VendorPerformanceRecord;
import com.procurement.scoringservice.entity.VendorScore;
import com.procurement.scoringservice.repository.ScoringWeightsRepository;
import com.procurement.scoringservice.repository.VendorCompositeScoreRepository;
import com.procurement.scoringservice.repository.VendorPerformanceRecordRepository;
import com.procurement.scoringservice.repository.VendorScoreRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Component
@RequiredArgsConstructor
@Slf4j
public class DataInitializer implements CommandLineRunner {

    private final ScoringWeightsRepository weightsRepository;
    private final VendorScoreRepository vendorScoreRepository;
    private final VendorPerformanceRecordRepository performanceRepository;
    private final VendorCompositeScoreRepository compositeScoreRepository;

    @Override
    public void run(String... args) {
        initScoringWeights();
        initVendorScores();
        initPerformanceRecords();
        initCompositeScores();
    }

    // ─── Scoring Weights ──────────────────────────────────────────────────────

    private void initScoringWeights() {
        if (weightsRepository.count() == 0) {
            createWeights("DEFAULT",      new BigDecimal("0.35"), new BigDecimal("0.35"), new BigDecimal("0.20"), new BigDecimal("0.10"), "admin@procurement.com");
            createWeights("IT",           new BigDecimal("0.30"), new BigDecimal("0.40"), new BigDecimal("0.20"), new BigDecimal("0.10"), "admin@procurement.com");
            createWeights("Construction", new BigDecimal("0.40"), new BigDecimal("0.30"), new BigDecimal("0.20"), new BigDecimal("0.10"), "admin@procurement.com");
            createWeights("Electronics",  new BigDecimal("0.30"), new BigDecimal("0.40"), new BigDecimal("0.20"), new BigDecimal("0.10"), "admin@procurement.com");
            createWeights("Stationery",   new BigDecimal("0.25"), new BigDecimal("0.30"), new BigDecimal("0.35"), new BigDecimal("0.10"), "admin@procurement.com");
            createWeights("Furniture",    new BigDecimal("0.30"), new BigDecimal("0.35"), new BigDecimal("0.25"), new BigDecimal("0.10"), "admin@procurement.com");
            log.info("Scoring weights initialized");
        }
    }

    private void createWeights(String category, BigDecimal timeliness, BigDecimal quality,
                                BigDecimal cost, BigDecimal responsiveness, String updatedBy) {
        ScoringWeights w = new ScoringWeights();
        w.setCategory(category);
        w.setTimelinessWeight(timeliness);
        w.setQualityWeight(quality);
        w.setCostWeight(cost);
        w.setResponsivenessWeight(responsiveness);
        w.setLastUpdated(LocalDateTime.now().minusDays(30));
        w.setUpdatedBy(updatedBy);
        weightsRepository.save(w);
    }

    // ─── Vendor Scores ────────────────────────────────────────────────────────

    private void initVendorScores() {
        if (vendorScoreRepository.count() == 0) {
            // Vendor IDs: TechSupply=1, BuildRight=2, OfficeEssentials=3, ElectroWorld=4, FurniturePlus=5
            // Metrics: TIMELINESS, QUALITY, COST_EFFICIENCY, RESPONSIVENESS

            // TechSupply Corp (vendorId=1) – HIGH performer
            createScore(1L, "TIMELINESS",       new BigDecimal("88.50"), "LOW");
            createScore(1L, "QUALITY",           new BigDecimal("91.00"), "LOW");
            createScore(1L, "COST_EFFICIENCY",   new BigDecimal("85.00"), "LOW");
            createScore(1L, "RESPONSIVENESS",    new BigDecimal("90.00"), "LOW");

            // BuildRight Ltd (vendorId=2) – HIGH performer
            createScore(2L, "TIMELINESS",       new BigDecimal("93.00"), "LOW");
            createScore(2L, "QUALITY",           new BigDecimal("95.00"), "LOW");
            createScore(2L, "COST_EFFICIENCY",   new BigDecimal("88.00"), "LOW");
            createScore(2L, "RESPONSIVENESS",    new BigDecimal("87.00"), "LOW");

            // OfficeEssentials Inc (vendorId=3) – MEDIUM performer
            createScore(3L, "TIMELINESS",       new BigDecimal("72.00"), "MEDIUM");
            createScore(3L, "QUALITY",           new BigDecimal("78.00"), "MEDIUM");
            createScore(3L, "COST_EFFICIENCY",   new BigDecimal("82.00"), "LOW");
            createScore(3L, "RESPONSIVENESS",    new BigDecimal("70.00"), "MEDIUM");

            // ElectroWorld Co (vendorId=4) – MEDIUM performer (newer vendor)
            createScore(4L, "TIMELINESS",       new BigDecimal("65.00"), "MEDIUM");
            createScore(4L, "QUALITY",           new BigDecimal("70.00"), "MEDIUM");
            createScore(4L, "COST_EFFICIENCY",   new BigDecimal("75.00"), "MEDIUM");
            createScore(4L, "RESPONSIVENESS",    new BigDecimal("68.00"), "MEDIUM");

            // FurniturePlus LLC (vendorId=5) – HIGH performer
            createScore(5L, "TIMELINESS",       new BigDecimal("85.00"), "LOW");
            createScore(5L, "QUALITY",           new BigDecimal("89.00"), "LOW");
            createScore(5L, "COST_EFFICIENCY",   new BigDecimal("80.00"), "LOW");
            createScore(5L, "RESPONSIVENESS",    new BigDecimal("83.00"), "LOW");

            log.info("Vendor scores initialized");
        }
    }

    private void createScore(Long vendorId, String metric, BigDecimal score, String riskLevel) {
        VendorScore vs = new VendorScore();
        vs.setVendorId(vendorId);
        vs.setPerformanceMetric(metric);
        vs.setWeightedScore(score);
        vs.setRiskLevel(riskLevel);
        vendorScoreRepository.save(vs);
    }

    // ─── Performance Records ──────────────────────────────────────────────────

    private void initPerformanceRecords() {
        if (performanceRepository.count() == 0) {
            LocalDate today = LocalDate.now();

            // TechSupply Corp (vendorId=1) – 3 months of records
            createPerformance(1L, 88, 91, 85, 90, today.minusMonths(2));
            createPerformance(1L, 90, 89, 87, 92, today.minusMonths(1));
            createPerformance(1L, 92, 93, 86, 91, today);

            // BuildRight Ltd (vendorId=2) – 3 months
            createPerformance(2L, 93, 95, 88, 87, today.minusMonths(2));
            createPerformance(2L, 91, 94, 89, 88, today.minusMonths(1));
            createPerformance(2L, 94, 96, 90, 89, today);

            // OfficeEssentials Inc (vendorId=3) – 3 months
            createPerformance(3L, 70, 75, 80, 68, today.minusMonths(2));
            createPerformance(3L, 72, 78, 82, 70, today.minusMonths(1));
            createPerformance(3L, 74, 80, 83, 72, today);

            // ElectroWorld Co (vendorId=4) – 2 months (newer)
            createPerformance(4L, 62, 68, 73, 65, today.minusMonths(1));
            createPerformance(4L, 65, 70, 75, 68, today);

            // FurniturePlus LLC (vendorId=5) – 3 months
            createPerformance(5L, 83, 87, 79, 81, today.minusMonths(2));
            createPerformance(5L, 85, 89, 80, 83, today.minusMonths(1));
            createPerformance(5L, 87, 91, 82, 85, today);

            log.info("Vendor performance records initialized");
        }
    }

    private void createPerformance(Long vendorId, int reliability, int quality,
                                    int cost, int responsiveness, LocalDate date) {
        VendorPerformanceRecord r = new VendorPerformanceRecord();
        r.setVendorId(vendorId);
        r.setReliabilityScore(reliability);
        r.setQualityScore(quality);
        r.setCostScore(cost);
        r.setResponsivenessScore(responsiveness);
        r.setCalculatedDate(date);
        performanceRepository.save(r);
    }

    // ─── Composite Scores ─────────────────────────────────────────────────────

    private void initCompositeScores() {
        if (compositeScoreRepository.count() == 0) {
            LocalDateTime now = LocalDateTime.now();

            // TechSupply Corp (vendorId=1) – LOW risk
            createComposite(1L,
                    new BigDecimal("90.00"), new BigDecimal("91.00"),
                    new BigDecimal("86.00"), new BigDecimal("91.00"),
                    new BigDecimal("89.65"), "LOW", now.minusDays(1), "2025-Q2");

            // BuildRight Ltd (vendorId=2) – LOW risk
            createComposite(2L,
                    new BigDecimal("93.00"), new BigDecimal("95.00"),
                    new BigDecimal("89.00"), new BigDecimal("88.00"),
                    new BigDecimal("92.45"), "LOW", now.minusDays(1), "2025-Q2");

            // OfficeEssentials Inc (vendorId=3) – MEDIUM risk
            createComposite(3L,
                    new BigDecimal("72.00"), new BigDecimal("78.00"),
                    new BigDecimal("82.00"), new BigDecimal("70.00"),
                    new BigDecimal("75.40"), "MEDIUM", now.minusDays(1), "2025-Q2");

            // ElectroWorld Co (vendorId=4) – MEDIUM risk
            createComposite(4L,
                    new BigDecimal("65.00"), new BigDecimal("70.00"),
                    new BigDecimal("75.00"), new BigDecimal("68.00"),
                    new BigDecimal("69.05"), "MEDIUM", now.minusDays(1), "2025-Q2");

            // FurniturePlus LLC (vendorId=5) – LOW risk
            createComposite(5L,
                    new BigDecimal("85.00"), new BigDecimal("89.00"),
                    new BigDecimal("80.00"), new BigDecimal("83.00"),
                    new BigDecimal("85.80"), "LOW", now.minusDays(1), "2025-Q2");

            log.info("Vendor composite scores initialized");
        }
    }

    private void createComposite(Long vendorId, BigDecimal timeliness, BigDecimal quality,
                                  BigDecimal cost, BigDecimal responsiveness,
                                  BigDecimal finalScore, String riskLevel,
                                  LocalDateTime calculatedAt, String period) {
        VendorCompositeScore cs = new VendorCompositeScore();
        cs.setVendorId(vendorId);
        cs.setTimelinessScore(timeliness);
        cs.setQualityScore(quality);
        cs.setCostScore(cost);
        cs.setResponsivenessScore(responsiveness);
        cs.setFinalWeightedScore(finalScore);
        cs.setRiskLevel(riskLevel);
        cs.setCalculatedAt(calculatedAt);
        cs.setPeriod(period);
        compositeScoreRepository.save(cs);
    }
}
