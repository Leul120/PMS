package com.procurement.scoringservice.controller;

import com.procurement.scoringservice.entity.VendorCompositeScore;
import com.procurement.scoringservice.entity.VendorPerformanceRecord;
import com.procurement.scoringservice.entity.VendorScore;
import com.procurement.scoringservice.service.ScoringService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/scores")
@RequiredArgsConstructor
public class ScoringController {

    private final ScoringService scoringService;

    /**
     * Manually trigger score recalculation for a vendor.
     * Uses the vendor's latest performance record as the basis.
     * Normally scores are updated automatically via the delivery.completed Kafka event.
     */
    @PostMapping("/calculate/{vendorId}")
    public ResponseEntity<Map<String, Object>> calculateScore(@PathVariable Long vendorId) {
        scoringService.recalculateScoreForVendor(vendorId);
        VendorScore latest = scoringService.getLatestScore(vendorId);
        if (latest == null) {
            return ResponseEntity.ok(Map.of(
                "message", "Recalculation triggered. No prior delivery data found for vendor " + vendorId + ".",
                "vendorId", vendorId
            ));
        }
        return ResponseEntity.ok(Map.of(
            "message", "Score recalculated successfully.",
            "vendorId", vendorId,
            "overallScore", latest.getWeightedScore(),
            "riskLevel", latest.getRiskLevel()
        ));
    }

    @GetMapping("/vendor/{vendorId}")
    public ResponseEntity<List<VendorScore>> getVendorScores(@PathVariable Long vendorId) {
        return ResponseEntity.ok(scoringService.getScoresByVendor(vendorId));
    }

    /**
     * Returns the latest VendorScore plus the latest VendorPerformanceRecord
     * (individual KPI breakdown) for a vendor.
     */
    @GetMapping("/vendor/{vendorId}/performance")
    public ResponseEntity<Map<String, Object>> getVendorPerformance(@PathVariable Long vendorId) {
        VendorScore score = scoringService.getLatestScore(vendorId);
        VendorPerformanceRecord record = scoringService.getLatestPerformanceRecord(vendorId);

        Map<String, Object> response = new java.util.LinkedHashMap<>();
        response.put("vendorId", vendorId);

        if (score != null) {
            response.put("overallScore", score.getWeightedScore());
            response.put("riskLevel", score.getRiskLevel());
        } else {
            response.put("overallScore", null);
            response.put("riskLevel", "Unknown");
        }

        if (record != null) {
            response.put("timelinessScore", record.getReliabilityScore());
            response.put("qualityScore", record.getQualityScore());
            response.put("costScore", record.getCostScore());
            response.put("responsivenessScore", record.getResponsivenessScore());
            response.put("lastCalculated", record.getCalculatedDate());
        } else {
            response.put("timelinessScore", null);
            response.put("qualityScore", null);
            response.put("costScore", null);
            response.put("responsivenessScore", null);
            response.put("lastCalculated", null);
        }

        return ResponseEntity.ok(response);
    }

    @GetMapping("/ranking")
    public ResponseEntity<List<VendorCompositeScore>> getRanking() {
        return ResponseEntity.ok(scoringService.getAllCompositeScoresRanked());
    }

    /** Recalculates scores for all vendors that have prior delivery data. */
    @PostMapping("/recalculate-all")
    public ResponseEntity<Map<String, Object>> recalculateAll() {
        int count = scoringService.recalculateAllVendors();
        return ResponseEntity.ok(Map.of(
            "message", "Bulk recalculation completed.",
            "vendorsProcessed", count
        ));
    }
}
