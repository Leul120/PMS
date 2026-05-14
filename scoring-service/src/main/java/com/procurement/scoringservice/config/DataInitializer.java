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
    // Weights must sum to 1.00 per category.
    // DEFAULT: Timeliness 35% | Quality 35% | Cost 20% | Responsiveness 10%

    private void initScoringWeights() {
        if (weightsRepository.count() == 0) {
            // DEFAULT — used for categories without a specific override
            createWeights("DEFAULT",      "0.35", "0.35", "0.20", "0.10", "admin@procurement.com");
            // IT — quality and timeliness matter most (uptime, SLA)
            createWeights("IT",           "0.30", "0.40", "0.20", "0.10", "admin@procurement.com");
            // Construction — timeliness is paramount (project delays are costly)
            createWeights("Construction", "0.40", "0.30", "0.20", "0.10", "admin@procurement.com");
            // Electronics — quality critical (failure rates, warranty claims)
            createWeights("Electronics",  "0.30", "0.40", "0.20", "0.10", "admin@procurement.com");
            // Stationery — cost matters more (commodity goods, high competition)
            createWeights("Stationery",   "0.25", "0.30", "0.35", "0.10", "admin@procurement.com");
            // Furniture — quality and timeliness balanced (installation coordination)
            createWeights("Furniture",    "0.30", "0.35", "0.25", "0.10", "admin@procurement.com");
            log.info("Scoring weights initialized");
        }
    }

    private void createWeights(String category, String timeliness, String quality,
                                String cost, String responsiveness, String updatedBy) {
        ScoringWeights w = new ScoringWeights();
        w.setCategory(category);
        w.setTimelinessWeight(new BigDecimal(timeliness));
        w.setQualityWeight(new BigDecimal(quality));
        w.setCostWeight(new BigDecimal(cost));
        w.setResponsivenessWeight(new BigDecimal(responsiveness));
        w.setLastUpdated(LocalDateTime.now().minusDays(30));
        w.setUpdatedBy(updatedBy);
        weightsRepository.save(w);
    }

    // ─── Vendor Scores ────────────────────────────────────────────────────────
    // Aggregate/current weighted scores per metric per vendor.
    // Vendor IDs: TechSupply=1, BuildRight=2, OfficeEssentials=3, ElectroWorld=4, FurniturePlus=5

    private void initVendorScores() {
        if (vendorScoreRepository.count() == 0) {

            // TechSupply Corp (vendorId=1) — LOW risk, steady improver
            createScore(1L, "TIMELINESS",      "90.00", "LOW");
            createScore(1L, "QUALITY",          "91.00", "LOW");
            createScore(1L, "COST_EFFICIENCY",  "86.00", "LOW");
            createScore(1L, "RESPONSIVENESS",   "91.00", "LOW");

            // BuildRight Ltd (vendorId=2) — LOW risk, top performer (just completed PO 1)
            createScore(2L, "TIMELINESS",      "94.00", "LOW");
            createScore(2L, "QUALITY",          "96.00", "LOW");
            createScore(2L, "COST_EFFICIENCY",  "90.00", "LOW");
            createScore(2L, "RESPONSIVENESS",   "89.00", "LOW");

            // OfficeEssentials Inc (vendorId=3) — MEDIUM risk, recovering after PO-5 dispute
            // Timeliness/Responsiveness dragged down by short delivery and invoice dispute
            createScore(3L, "TIMELINESS",      "72.00", "MEDIUM");
            createScore(3L, "QUALITY",          "78.00", "MEDIUM");
            createScore(3L, "COST_EFFICIENCY",  "82.00", "LOW");
            createScore(3L, "RESPONSIVENESS",   "68.00", "MEDIUM");

            // ElectroWorld Co (vendorId=4) — MEDIUM risk, newer vendor still proving itself
            createScore(4L, "TIMELINESS",      "67.00", "MEDIUM");
            createScore(4L, "QUALITY",          "72.00", "MEDIUM");
            createScore(4L, "COST_EFFICIENCY",  "76.00", "MEDIUM");
            createScore(4L, "RESPONSIVENESS",   "70.00", "MEDIUM");

            // FurniturePlus LLC (vendorId=5) — LOW risk, consistent quality
            createScore(5L, "TIMELINESS",      "88.00", "LOW");
            createScore(5L, "QUALITY",          "92.00", "LOW");
            createScore(5L, "COST_EFFICIENCY",  "83.00", "LOW");
            createScore(5L, "RESPONSIVENESS",   "86.00", "LOW");

            log.info("Vendor scores initialized");
        }
    }

    private void createScore(Long vendorId, String metric, String score, String riskLevel) {
        VendorScore vs = new VendorScore();
        vs.setVendorId(vendorId);
        vs.setPerformanceMetric(metric);
        vs.setWeightedScore(new BigDecimal(score));
        vs.setRiskLevel(riskLevel);
        vendorScoreRepository.save(vs);
    }

    // ─── Performance Records ──────────────────────────────────────────────────
    // Monthly snapshots per vendor — 6 months for established vendors, 4 for ElectroWorld.
    // Scores: reliabilityScore, qualityScore, costScore, responsivenessScore (all 0-100).
    //
    // Trends:
    //   TechSupply (1)       — gradual improvement over 6 months
    //   BuildRight (2)       — consistently high, slight uptick after completing PO-1
    //   OfficeEssentials (3) — declining in months -4 to -2 (dispute period), recovering
    //   ElectroWorld (4)     — newer vendor, moderate improvement over 4 months
    //   FurniturePlus (5)    — stable, consistently above average

    private void initPerformanceRecords() {
        if (performanceRepository.count() == 0) {
            LocalDate today = LocalDate.now();

            // ── TechSupply Corp (vendorId=1) ──
            createPerf(1L, 84, 87, 83, 86, today.minusMonths(5));
            createPerf(1L, 86, 88, 84, 87, today.minusMonths(4));
            createPerf(1L, 88, 89, 84, 88, today.minusMonths(3));
            createPerf(1L, 88, 91, 85, 90, today.minusMonths(2));
            createPerf(1L, 90, 89, 87, 92, today.minusMonths(1));
            createPerf(1L, 92, 93, 86, 91, today);

            // ── BuildRight Ltd (vendorId=2) ──
            createPerf(2L, 90, 92, 86, 84, today.minusMonths(5));
            createPerf(2L, 91, 93, 87, 85, today.minusMonths(4));
            createPerf(2L, 93, 95, 88, 87, today.minusMonths(3));
            createPerf(2L, 91, 94, 89, 88, today.minusMonths(2));
            createPerf(2L, 94, 96, 90, 89, today.minusMonths(1));
            createPerf(2L, 95, 97, 91, 90, today);  // best ever after successful PO-1 delivery

            // ── OfficeEssentials Inc (vendorId=3) — dispute started around month -3 ──
            createPerf(3L, 75, 80, 82, 72, today.minusMonths(5));  // pre-dispute, adequate
            createPerf(3L, 74, 79, 81, 71, today.minusMonths(4));  // slipping
            createPerf(3L, 70, 75, 80, 67, today.minusMonths(3));  // short delivery on PO-5
            createPerf(3L, 68, 72, 79, 65, today.minusMonths(2));  // dispute open, worst month
            createPerf(3L, 70, 75, 80, 68, today.minusMonths(1));  // dispute resolved, recovering
            createPerf(3L, 74, 80, 83, 72, today);                 // tax cert renewed, stabilising

            // ── ElectroWorld Co (vendorId=4) — newer vendor, 4 months of history ──
            createPerf(4L, 60, 65, 71, 62, today.minusMonths(3));  // initial performance
            createPerf(4L, 62, 68, 73, 65, today.minusMonths(2));
            createPerf(4L, 65, 70, 75, 68, today.minusMonths(1));
            createPerf(4L, 67, 72, 76, 70, today);                 // showing improvement

            // ── FurniturePlus LLC (vendorId=5) ──
            createPerf(5L, 81, 85, 77, 79, today.minusMonths(5));
            createPerf(5L, 82, 86, 78, 80, today.minusMonths(4));
            createPerf(5L, 83, 87, 79, 81, today.minusMonths(3));
            createPerf(5L, 85, 89, 80, 83, today.minusMonths(2));
            createPerf(5L, 87, 91, 82, 85, today.minusMonths(1));
            createPerf(5L, 88, 92, 83, 86, today);

            log.info("Vendor performance records initialized: 32 monthly records");
        }
    }

    private void createPerf(Long vendorId, int reliability, int quality,
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
    // Two quarterly snapshots per vendor: Q1-2025 (historical) and Q2-2025 (current).
    // Final weighted score uses DEFAULT weights: T=35%, Q=35%, C=20%, R=10%.

    private void initCompositeScores() {
        if (compositeScoreRepository.count() == 0) {
            LocalDateTime now = LocalDateTime.now();
            LocalDateTime q1Calc = now.minusMonths(3);  // end of Q1 2025

            // ── Q1 2025 — Historical snapshot ────────────────────────────────
            // TechSupply Q1: 85*0.35 + 88*0.35 + 84*0.20 + 87*0.10 = 86.05
            createComposite(1L, "86.00", "88.00", "84.00", "87.00", "86.05", "LOW",  q1Calc, "2025-Q1");
            // BuildRight Q1: 91*0.35 + 93*0.35 + 87*0.20 + 85*0.10 = 90.30
            createComposite(2L, "91.00", "93.00", "87.00", "85.00", "90.30", "LOW",  q1Calc, "2025-Q1");
            // OfficeEssentials Q1 (dispute period): 70*0.35 + 75*0.35 + 80*0.20 + 67*0.10 = 73.45
            createComposite(3L, "70.00", "75.00", "80.00", "67.00", "73.45", "MEDIUM", q1Calc, "2025-Q1");
            // ElectroWorld Q1 (limited data): 62*0.35 + 68*0.35 + 73*0.20 + 65*0.10 = 66.60
            createComposite(4L, "62.00", "68.00", "73.00", "65.00", "66.60", "MEDIUM", q1Calc, "2025-Q1");
            // FurniturePlus Q1: 83*0.35 + 87*0.35 + 78*0.20 + 81*0.10 = 83.20
            createComposite(5L, "83.00", "87.00", "78.00", "81.00", "83.20", "LOW",  q1Calc, "2025-Q1");

            // ── Q2 2025 — Current snapshot ────────────────────────────────────
            // TechSupply Q2: 90*0.35 + 91*0.35 + 86*0.20 + 91*0.10 = 89.65
            createComposite(1L, "90.00", "91.00", "86.00", "91.00", "89.65", "LOW",  now.minusDays(1), "2025-Q2");
            // BuildRight Q2: 94*0.35 + 96*0.35 + 90*0.20 + 89*0.10 = 93.45
            createComposite(2L, "94.00", "96.00", "90.00", "89.00", "93.45", "LOW",  now.minusDays(1), "2025-Q2");
            // OfficeEssentials Q2 (recovering): 72*0.35 + 78*0.35 + 82*0.20 + 70*0.10 = 75.40
            createComposite(3L, "72.00", "78.00", "82.00", "70.00", "75.40", "MEDIUM", now.minusDays(1), "2025-Q2");
            // ElectroWorld Q2: 65*0.35 + 70*0.35 + 75*0.20 + 68*0.10 = 69.05
            createComposite(4L, "65.00", "70.00", "75.00", "68.00", "69.05", "MEDIUM", now.minusDays(1), "2025-Q2");
            // FurniturePlus Q2: 87*0.35 + 91*0.35 + 82*0.20 + 85*0.10 = 87.30
            createComposite(5L, "87.00", "91.00", "82.00", "85.00", "87.30", "LOW",  now.minusDays(1), "2025-Q2");

            log.info("Vendor composite scores initialized: 10 records (Q1-2025 + Q2-2025)");
        }
    }

    private void createComposite(Long vendorId, String timeliness, String quality,
                                  String cost, String responsiveness,
                                  String finalScore, String riskLevel,
                                  LocalDateTime calculatedAt, String period) {
        VendorCompositeScore cs = new VendorCompositeScore();
        cs.setVendorId(vendorId);
        cs.setTimelinessScore(new BigDecimal(timeliness));
        cs.setQualityScore(new BigDecimal(quality));
        cs.setCostScore(new BigDecimal(cost));
        cs.setResponsivenessScore(new BigDecimal(responsiveness));
        cs.setFinalWeightedScore(new BigDecimal(finalScore));
        cs.setRiskLevel(riskLevel);
        cs.setCalculatedAt(calculatedAt);
        cs.setPeriod(period);
        compositeScoreRepository.save(cs);
    }
}
