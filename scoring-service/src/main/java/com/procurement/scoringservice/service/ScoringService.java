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
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.kafka.core.KafkaTemplate;
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
    
    @KafkaListener(topics = "delivery.completed", groupId = "scoring-service-group")
    @Transactional
    public void handleDeliveryCompleted(DeliveryCompletedEvent event) {
        log.info("Received delivery completed event for vendor: {}", event.getVendorId());
        calculateAndUpdateScore(event.getVendorId(), event);
    }
    
    @Transactional
    public void calculateAndUpdateScore(Long vendorId, DeliveryCompletedEvent deliveryEvent) {
        // Calculate timeliness score: max(0, (1 - delayDays/expectedDays) * 100)
        // Assuming expected days is 30 for simplicity
        int expectedDays = 30;
        int timelinessScore = Math.max(0, (int)((1.0 - (double)deliveryEvent.getDelayDays() / expectedDays) * 100));
        
        // Calculate quality score based on quality remarks
        int qualityScore = 100;
        if (deliveryEvent.getQualityRemarks() != null) {
            if (deliveryEvent.getQualityRemarks().toLowerCase().contains("damaged")) {
                qualityScore = 70;
            } else if (deliveryEvent.getQualityRemarks().toLowerCase().contains("partial")) {
                qualityScore = 85;
            }
        }
        
        // For cost and responsiveness, use default values or fetch from historical data
        int costScore = 85; // This would typically come from bid comparison
        int responsivenessScore = 90; // Based on past response times
        
        // Calculate weighted overall score
        BigDecimal overallScore = BigDecimal.valueOf(
            timelinessScore * timelinessWeight +
            qualityScore * qualityWeight +
            costScore * costWeight +
            responsivenessScore * responsivenessWeight
        ).setScale(2, RoundingMode.HALF_UP);
        
        // Determine risk level
        String riskLevel;
        if (overallScore.compareTo(BigDecimal.valueOf(80)) >= 0) {
            riskLevel = "Low";
        } else if (overallScore.compareTo(BigDecimal.valueOf(60)) >= 0) {
            riskLevel = "Medium";
        } else {
            riskLevel = "High";
        }
        
        // Save performance record
        VendorPerformanceRecord record = new VendorPerformanceRecord();
        record.setVendorId(vendorId);
        record.setReliabilityScore(timelinessScore);
        record.setQualityScore(qualityScore);
        record.setCostScore(costScore);
        record.setCalculatedDate(LocalDate.now());
        performanceRecordRepository.save(record);
        
        // Update or create vendor score
        VendorScore vendorScore = vendorScoreRepository.findByVendorIdAndPerformanceMetric(vendorId, "Overall")
            .orElse(new VendorScore());
        vendorScore.setVendorId(vendorId);
        vendorScore.setPerformanceMetric("Overall");
        vendorScore.setWeightedScore(overallScore);
        vendorScore.setRiskLevel(riskLevel);
        vendorScoreRepository.save(vendorScore);
        
        log.info("Vendor score updated: {} - Score: {} - Risk: {}", vendorId, overallScore, riskLevel);
        
        // Publish score updated event
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
