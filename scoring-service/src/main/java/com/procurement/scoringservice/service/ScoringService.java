package com.procurement.scoringservice.service;

import com.procurement.scoringservice.entity.VendorCompositeScore;
import com.procurement.scoringservice.entity.VendorPerformanceRecord;
import com.procurement.scoringservice.entity.VendorScore;
import com.procurement.scoringservice.event.DeliveryCompletedEvent;
import com.procurement.scoringservice.event.BidSubmittedEvent;
import com.procurement.scoringservice.event.InvoiceDiscrepancyEvent;
import com.procurement.scoringservice.event.InvoicePaidEvent;
import com.procurement.scoringservice.event.ScoreUpdatedEvent;
import com.procurement.scoringservice.repository.VendorCompositeScoreRepository;
import com.procurement.scoringservice.repository.VendorPerformanceRecordRepository;
import com.procurement.scoringservice.repository.VendorScoreRepository;
import com.procurement.scoringservice.scoring.DeliveryQualityScorer;
import com.procurement.scoringservice.tenant.TenantContext;
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
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

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
    private final VendorCompositeScoreRepository compositeScoreRepository;
    private final KafkaTemplate<String, Object> kafkaTemplate;
    private final PlatformTransactionManager transactionManager;
    
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
        log.info("Received delivery completed event for vendor: {}, tenant: {}",
            event.getVendorId(), event.getTenantId());
        // Kafka consumers have no HTTP context — set tenant from the event payload
        if (event.getTenantId() != null) {
            TenantContext.setCurrentTenant(event.getTenantId());
        }
        try {
            calculateAndUpdateScore(event.getVendorId(), event);
        } finally {
            TenantContext.clear();
        }
    }

    @DltHandler
    public void handleDlt(DeliveryCompletedEvent event,
                          org.apache.kafka.clients.consumer.ConsumerRecord<?, ?> record) {
        log.error("Scoring DLT: exhausted retries for delivery event. Topic={}, vendorId={}",
            record.topic(), event != null ? event.getVendorId() : "unknown");
    }

    @KafkaListener(topics = "bid.submitted", groupId = "scoring-service-group")
    @Transactional
    public void handleBidSubmitted(BidSubmittedEvent event) {
        if (event == null || event.getVendorId() == null) return;
        if (event.getTenantId() != null) TenantContext.setCurrentTenant(event.getTenantId());
        try {
            log.info("Bid submitted event for vendor {} — recording responsiveness boost", event.getVendorId());
            applyMetricAdjustment(event.getVendorId(), null, null, null, 5);
        } finally {
            TenantContext.clear();
        }
    }

    @KafkaListener(topics = "invoice.discrepancy", groupId = "scoring-service-group")
    @Transactional
    public void handleInvoiceDiscrepancy(InvoiceDiscrepancyEvent event) {
        if (event == null || event.getPoId() == null) return;
        log.info("Invoice discrepancy on PO {} — vendor score will be penalised on next delivery recalc", event.getPoId());
    }

    @KafkaListener(topics = "invoice.paid", groupId = "scoring-service-group")
    @Transactional
    public void handleInvoicePaid(InvoicePaidEvent event) {
        if (event == null || event.getVendorId() == null) return;
        if (event.getTenantId() != null) TenantContext.setCurrentTenant(event.getTenantId());
        try {
            log.info("Invoice paid for vendor {} — recording payment reliability boost", event.getVendorId());
            applyMetricAdjustment(event.getVendorId(), null, null, 5, null);
        } finally {
            TenantContext.clear();
        }
    }

    private void applyMetricAdjustment(Long vendorId, Integer timelinessDelta, Integer qualityDelta,
                                       Integer costDelta, Integer responsivenessDelta) {
        VendorPerformanceRecord latest =
            performanceRecordRepository.findTopByVendorIdOrderByCalculatedDateDesc(vendorId).orElse(null);
        int timeliness = latest != null && latest.getReliabilityScore() != null ? latest.getReliabilityScore() : 85;
        int quality = latest != null && latest.getQualityScore() != null ? latest.getQualityScore() : 85;
        int cost = latest != null && latest.getCostScore() != null ? latest.getCostScore() : 85;
        int responsiveness = latest != null && latest.getResponsivenessScore() != null ? latest.getResponsivenessScore() : 85;
        if (timelinessDelta != null) timeliness = Math.min(100, Math.max(0, timeliness + timelinessDelta));
        if (qualityDelta != null) quality = Math.min(100, Math.max(0, quality + qualityDelta));
        if (costDelta != null) cost = Math.min(100, Math.max(0, cost + costDelta));
        if (responsivenessDelta != null) responsiveness = Math.min(100, Math.max(0, responsiveness + responsivenessDelta));

        DeliveryCompletedEvent synthetic = new DeliveryCompletedEvent();
        synthetic.setVendorId(vendorId);
        synthetic.setTenantId(TenantContext.getCurrentTenant());
        synthetic.setExpectedDays(30);
        synthetic.setDelayDays(Math.max(0, (int) Math.round((1.0 - timeliness / 100.0) * 30)));
        synthetic.setQualityRating(quality < 70 ? "REJECTED" : quality < 85 ? "ACCEPTED_WITH_ISSUES" : "ACCEPTED");
        synthetic.setQualityRemarks("");
        synthetic.setQuantityDelivered(0);

        Long tenantId = TenantContext.getCurrentTenant();
        if (tenantId == null) return;

        VendorPerformanceRecord record = new VendorPerformanceRecord();
        record.setTenantId(tenantId);
        record.setVendorId(vendorId);
        record.setReliabilityScore(timeliness);
        record.setQualityScore(quality);
        record.setCostScore(cost);
        record.setResponsivenessScore(responsiveness);
        record.setCalculatedDate(LocalDate.now());
        performanceRecordRepository.save(record);

        BigDecimal overallScore = BigDecimal.valueOf(
            timeliness * timelinessWeight +
            quality * qualityWeight +
            cost * costWeight +
            responsiveness * responsivenessWeight
        ).setScale(2, RoundingMode.HALF_UP);

        String riskLevel = overallScore.compareTo(BigDecimal.valueOf(80)) >= 0 ? "Low"
            : overallScore.compareTo(BigDecimal.valueOf(60)) >= 0 ? "Medium" : "High";

        VendorScore vendorScore = vendorScoreRepository
            .findByVendorIdAndPerformanceMetric(vendorId, "Overall")
            .orElseGet(() -> {
                VendorScore ns = new VendorScore();
                ns.setTenantId(tenantId);
                return ns;
            });
        vendorScore.setVendorId(vendorId);
        vendorScore.setPerformanceMetric("Overall");
        vendorScore.setWeightedScore(overallScore);
        vendorScore.setRiskLevel(riskLevel);
        vendorScoreRepository.save(vendorScore);

        ScoreUpdatedEvent scoreEvent = ScoreUpdatedEvent.builder()
            .tenantId(tenantId)
            .vendorId(vendorId)
            .overallScore(overallScore)
            .riskLevel(riskLevel)
            .updatedAt(LocalDateTime.now())
            .build();
        kafkaTemplate.send("score.updated", scoreEvent);
    }
    
    @Transactional
    public void calculateAndUpdateScore(Long vendorId, DeliveryCompletedEvent deliveryEvent) {
        // ── Timeliness score ──────────────────────────────────────────────────
        // Formula: max(0, (1 - delayDays / expectedDays) * 100).
        // Uses the actual PO delivery window. Falls back to 30 days if not provided.
        int expectedDays = (deliveryEvent.getExpectedDays() != null && deliveryEvent.getExpectedDays() > 0)
            ? deliveryEvent.getExpectedDays() : 30;
        int timelinessScore = Math.max(0,
            (int) ((1.0 - (double) deliveryEvent.getDelayDays() / expectedDays) * 100));

        // ── Quality score ─────────────────────────────────────────────────────
        int qualityScore = DeliveryQualityScorer.computeQualityScore(
            deliveryEvent.getQualityRating(),
            deliveryEvent.getQualityIssueTypes(),
            deliveryEvent.getQuantityDelivered(),
            deliveryEvent.getQuantityOrdered(),
            deliveryEvent.getQualityRemarks());

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

        Long tenantId = TenantContext.getCurrentTenant();
        if (tenantId == null) {
            throw new IllegalStateException("TenantContext not set — cannot persist performance record for vendor " + vendorId);
        }

        // ── Persist performance record ────────────────────────────────────────
        VendorPerformanceRecord record = new VendorPerformanceRecord();
        record.setTenantId(tenantId);
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
            .orElseGet(() -> {
                VendorScore newScore = new VendorScore();
                newScore.setTenantId(tenantId);
                return newScore;
            });
        vendorScore.setVendorId(vendorId);
        vendorScore.setPerformanceMetric("Overall");
        vendorScore.setWeightedScore(overallScore);
        vendorScore.setRiskLevel(riskLevel);
        vendorScoreRepository.save(vendorScore);

        // ── Update composite score (used by ranking endpoint) ─────────────────
        VendorCompositeScore composite = compositeScoreRepository
            .findTopByVendorIdAndPeriodOrderByCalculatedAtDesc(vendorId, "LIVE")
            .orElseGet(() -> {
                VendorCompositeScore cs = new VendorCompositeScore();
                cs.setTenantId(tenantId);
                return cs;
            });
        composite.setVendorId(vendorId);
        composite.setTimelinessScore(BigDecimal.valueOf(timelinessScore));
        composite.setQualityScore(BigDecimal.valueOf(qualityScore));
        composite.setCostScore(BigDecimal.valueOf(costScore));
        composite.setResponsivenessScore(BigDecimal.valueOf(responsivenessScore));
        composite.setFinalWeightedScore(overallScore);
        composite.setRiskLevel(riskLevel);
        composite.setCalculatedAt(LocalDateTime.now());
        composite.setPeriod("LIVE");
        compositeScoreRepository.save(composite);

        log.info("Vendor {} score updated: {} (Risk: {}) — timeliness={}, quality={}, cost={}, responsiveness={}",
            vendorId, overallScore, riskLevel, timelinessScore, qualityScore, costScore, responsivenessScore);

        // ── Publish score updated event ───────────────────────────────────────
        ScoreUpdatedEvent event = ScoreUpdatedEvent.builder()
            .tenantId(tenantId)
            .vendorId(vendorId)
            .overallScore(overallScore)
            .riskLevel(riskLevel)
            .updatedAt(LocalDateTime.now())
            .build();
        kafkaTemplate.send("score.updated", event)
            .whenComplete((result, ex) -> {
                if (ex != null) log.error("Failed to publish event to score.updated: {}", ex.getMessage());
            });
    }
    
    @Transactional(readOnly = true)
    public List<VendorScore> getScoresByVendor(Long vendorId) {
        return vendorScoreRepository.findByVendorId(vendorId);
    }

    @Transactional(readOnly = true)
    public VendorScore getLatestScore(Long vendorId) {
        return vendorScoreRepository
            .findByVendorIdAndPerformanceMetric(vendorId, "Overall")
            .orElse(null);
    }

    @Transactional(readOnly = true)
    public List<VendorScore> getAllScoresRanked() {
        return vendorScoreRepository.findAllByOrderByWeightedScoreDesc();
    }

    @Transactional(readOnly = true)
    public List<VendorCompositeScore> getAllCompositeScoresRanked() {
        // Keep only the latest composite score per vendor, then sort by score descending
        return compositeScoreRepository.findAll().stream()
            .collect(java.util.stream.Collectors.toMap(
                VendorCompositeScore::getVendorId,
                cs -> cs,
                (cs1, cs2) -> cs1.getCalculatedAt().isAfter(cs2.getCalculatedAt()) ? cs1 : cs2
            ))
            .values().stream()
            .sorted(java.util.Comparator.comparing(VendorCompositeScore::getFinalWeightedScore).reversed())
            .toList();
    }

    @Transactional(readOnly = true)
    public VendorPerformanceRecord getLatestPerformanceRecord(Long vendorId) {
        return performanceRecordRepository.findTopByVendorIdOrderByCalculatedDateDesc(vendorId)
            .orElse(null);
    }

    /** Recalculates scores for every vendor that has at least one stored record. */
    public int recalculateAllVendors() {
        Long tenantId = TenantContext.getCurrentTenant();
        List<Long> vendorIds = vendorScoreRepository.findAllByOrderByWeightedScoreDesc().stream()
            .map(VendorScore::getVendorId)
            .distinct()
            .toList();

        TransactionTemplate txTemplate = new TransactionTemplate(transactionManager);
        int failures = 0;
        for (Long vendorId : vendorIds) {
            try {
                txTemplate.execute(status -> {
                    // Restore tenant context inside the new transaction (thread-local is inherited)
                    if (tenantId != null) TenantContext.setCurrentTenant(tenantId);
                    try {
                        recalculateScoreForVendor(vendorId);
                    } finally {
                        TenantContext.clear();
                    }
                    return null;
                });
            } catch (Exception e) {
                failures++;
                log.warn("Failed to recalculate score for vendor {}: {}", vendorId, e.getMessage());
            }
        }
        log.info("Bulk recalculation completed for {} vendor(s), {} failed", vendorIds.size(), failures);
        return vendorIds.size();
    }

    /**
     * Manually recalculate a vendor's score using their latest performance record.
     * Creates a synthetic DeliveryCompletedEvent from stored history so the same
     * formula is applied consistently.
     */
    @Transactional
    public void recalculateScoreForVendor(Long vendorId) {
        VendorPerformanceRecord latest =
            performanceRecordRepository.findTopByVendorIdOrderByCalculatedDateDesc(vendorId)
                .orElse(null);

        // Reconstruct a synthetic event from stored performance data so the same
        // scoring formula is applied consistently without distorting history.
        DeliveryCompletedEvent syntheticEvent = new DeliveryCompletedEvent();
        syntheticEvent.setVendorId(vendorId);
        syntheticEvent.setExpectedDays(30);
        if (latest != null) {
            // Reverse-engineer delayDays from stored reliability (timeliness) score:
            // timeliness = max(0, (1 - delayDays/expectedDays) * 100)
            // => delayDays = (1 - timeliness/100) * expectedDays
            int storedTimeliness = latest.getReliabilityScore() != null ? latest.getReliabilityScore() : 100;
            syntheticEvent.setDelayDays(Math.max(0, (int) Math.round((1.0 - storedTimeliness / 100.0) * 30)));
            int storedQuality = latest.getQualityScore() != null ? latest.getQualityScore() : 100;
            if (storedQuality < 70) {
                syntheticEvent.setQualityRating("REJECTED");
            } else if (storedQuality < 85) {
                syntheticEvent.setQualityRating("ACCEPTED_WITH_ISSUES");
            } else {
                syntheticEvent.setQualityRating("ACCEPTED");
            }
            syntheticEvent.setQualityRemarks("");
        } else {
            syntheticEvent.setDelayDays(0);
            syntheticEvent.setQualityRating("ACCEPTED");
            syntheticEvent.setQualityRemarks("");
        }
        syntheticEvent.setQuantityDelivered(0);

        calculateAndUpdateScore(vendorId, syntheticEvent);
        log.info("Manual score recalculation completed for vendor: {}", vendorId);
    }
}
