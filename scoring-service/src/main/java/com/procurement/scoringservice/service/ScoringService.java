package com.procurement.scoringservice.service;

import com.procurement.scoringservice.entity.VendorPerformanceRecord;
import com.procurement.scoringservice.entity.VendorScore;
import com.procurement.scoringservice.event.DeliveryCompletedEvent;
import com.procurement.scoringservice.event.ScoreUpdatedEvent;
import com.procurement.scoringservice.repository.VendorPerformanceRecordRepository;
import com.procurement.scoringservice.repository.VendorScoreRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.kafka.annotation.DltHandler;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.kafka.annotation.RetryableTopic;
import org.springframework.kafka.retrytopic.TopicSuffixingStrategy;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.retry.annotation.Backoff;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class ScoringService {
    
    private final VendorScoreRepository vendorScoreRepository;
    private final VendorPerformanceRecordRepository performanceRecordRepository;
    private final KafkaTemplate<String, Object> kafkaTemplate;
    
    @Value("${scoring.weights.timeliness:0.35}")
    private double timelinessWeight;
    
    @Value("${scoring.weights.quality:0.35}")
    private double qualityWeight;
    
    @Value("${scoring.weights.cost:0.20}")
    private double costWeight;
    
    @Value("${scoring.weights.responsiveness:0.10}")
    private double responsivenessWeight;
    
    @RetryableTopic(
        attempts = "3",
        backoff = @Backoff(delay = 2000, multiplier = 2.0),
        topicSuffixingStrategy = TopicSuffixingStrategy.SUFFIX_WITH_INDEX_VALUE
    )
    @KafkaListener(topics = "delivery.completed", groupId = "scoring-service-group")
    @Transactional
    public void handleDeliveryCompleted(DeliveryCompletedEvent event) {
        log.info("Received delivery completed event for vendor: {}", event.getVendorId());
        calculateAndUpdateScore(event.getVendorId(), event);
    }

    @DltHandler
    public void handleDlt(DeliveryCompletedEvent event,
                          org.apache.kafka.clients.consumer.ConsumerRecord<?, ?> record) {
        log.error("Scoring DLT: exhausted retries for delivery event. Topic={}, vendorId={}",
            record.topic(), event != null ? event.getVendorId() : "unknown");
    }
    
    @Transactional
    public void calculateAndUpdateScore(Long vendorId, DeliveryCompletedEvent deliveryEvent) {
        // ── Timeliness score ──────────────────────────────────────────────────
        // Formula: max(0, (1 - delayDays / 30) * 100). On-time = 100, 30+ days late = 0.
        int expectedDays = 30;
        int timelinessScore = Math.max(0,
            (int) ((1.0 - (double) deliveryEvent.getDelayDays() / expectedDays) * 100));

        // ── Quality score ─────────────────────────────────────────────────────
        // Parse quality remarks for known keywords; default 100 if no issues.
        int qualityScore = 100;
        String remarks = deliveryEvent.getQualityRemarks();
        if (remarks != null) {
            String lower = remarks.toLowerCase();
            if (lower.contains("damaged") || lower.contains("broken") || lower.contains("defective")) {
                qualityScore = 60;
            } else if (lower.contains("partial") || lower.contains("incomplete") || lower.contains("missing")) {
                qualityScore = 75;
            } else if (lower.contains("minor") || lower.contains("slight")) {
                qualityScore = 88;
            }
        }

        // ── Cost score ────────────────────────────────────────────────────────
        // Derived from historical cost scores for this vendor.
        // If no history exists, default to 80 (neutral — not penalised, not rewarded).
        int costScore = performanceRecordRepository
            .findTopByVendorIdOrderByCalculatedDateDesc(vendorId)
            .map(VendorPerformanceRecord::getCostScore)
            .filter(s -> s != null && s > 0)
            .orElse(80);

        // ── Responsiveness score ──────────────────────────────────────────────
        // Average of the last 5 responsiveness scores for this vendor.
        // Falls back to 85 if no history.
        List<VendorPerformanceRecord> history =
            performanceRecordRepository.findTop5ByVendorIdOrderByCalculatedDateDesc(vendorId);
        int responsivenessScore = history.isEmpty() ? 85 :
            (int) history.stream()
                .filter(r -> r.getResponsivenessScore() != null && r.getResponsivenessScore() > 0)
                .mapToInt(VendorPerformanceRecord::getResponsivenessScore)
                .average()
                .orElse(85);

        // ── Weighted overall score ────────────────────────────────────────────
        BigDecimal overallScore = BigDecimal.valueOf(
            timelinessScore    * timelinessWeight +
            qualityScore       * qualityWeight +
            costScore          * costWeight +
            responsivenessScore * responsivenessWeight
        ).setScale(2, RoundingMode.HALF_UP);

        // ── Risk level ────────────────────────────────────────────────────────
        String riskLevel;
        if (overallScore.compareTo(BigDecimal.valueOf(80)) >= 0)      riskLevel = "Low";
        else if (overallScore.compareTo(BigDecimal.valueOf(60)) >= 0) riskLevel = "Medium";
        else                                                           riskLevel = "High";

        // ── Persist performance record ────────────────────────────────────────
        VendorPerformanceRecord record = new VendorPerformanceRecord();
        record.setVendorId(vendorId);
        record.setReliabilityScore(timelinessScore);
        record.setQualityScore(qualityScore);
        record.setCostScore(costScore);
        record.setResponsivenessScore(responsivenessScore);
        record.setCalculatedDate(LocalDate.now());
        performanceRecordRepository.save(record);

        // ── Update or create overall vendor score ─────────────────────────────
        VendorScore vendorScore = vendorScoreRepository
            .findByVendorIdAndPerformanceMetric(vendorId, "Overall")
            .orElse(new VendorScore());
        vendorScore.setVendorId(vendorId);
        vendorScore.setPerformanceMetric("Overall");
        vendorScore.setWeightedScore(overallScore);
        vendorScore.setRiskLevel(riskLevel);
        vendorScoreRepository.save(vendorScore);

        log.info("Vendor {} score updated: {} (Risk: {}) — timeliness={}, quality={}, cost={}, responsiveness={}",
            vendorId, overallScore, riskLevel, timelinessScore, qualityScore, costScore, responsivenessScore);

        // ── Publish score updated event ───────────────────────────────────────
        ScoreUpdatedEvent event = ScoreUpdatedEvent.builder()
            .vendorId(vendorId)
            .overallScore(overallScore)
            .riskLevel(riskLevel)
            .updatedAt(LocalDateTime.now())
            .build();
        kafkaTemplate.send("score.updated", event);
    }
    
    public List<VendorScore> getScoresByVendor(Long vendorId) {
        return vendorScoreRepository.findByVendorId(vendorId);
    }
    
    public List<VendorScore> getAllScoresRanked() {
        return vendorScoreRepository.findAllByOrderByWeightedScoreDesc();
    }
    
    public VendorPerformanceRecord getLatestPerformanceRecord(Long vendorId) {
        return performanceRecordRepository.findTopByVendorIdOrderByCalculatedDateDesc(vendorId)
            .orElse(null);
    }
}
