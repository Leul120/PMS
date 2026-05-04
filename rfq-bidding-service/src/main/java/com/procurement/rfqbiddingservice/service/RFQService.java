package com.procurement.rfqbiddingservice.service;

import com.procurement.rfqbiddingservice.dto.*;
import com.procurement.rfqbiddingservice.entity.Bid;
import com.procurement.rfqbiddingservice.entity.RFQ;
import com.procurement.rfqbiddingservice.event.BidSubmittedEvent;
import com.procurement.rfqbiddingservice.event.RFQPublishedEvent;
import com.procurement.rfqbiddingservice.repository.BidRepository;
import com.procurement.rfqbiddingservice.repository.RFQRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class RFQService {
    
    private final RFQRepository rfqRepository;
    private final BidRepository bidRepository;
    private final KafkaTemplate<String, Object> kafkaTemplate;
    
    @Transactional
    public RFQResponse createRFQ(RFQRequest request, Long userId) {
        RFQ rfq = new RFQ();
        rfq.setTitle(request.getTitle());
        rfq.setDescription(request.getDescription());
        rfq.setDeadline(request.getDeadline());
        rfq.setStatus("Open");
        rfq.setCreatedBy(userId);
        rfq.setCreatedAt(LocalDateTime.now());
        rfq.setEstimatedValue(request.getEstimatedValue());
        rfq.setCategoryId(request.getCategoryId());
        rfq.setExpectedQuantity(request.getExpectedQuantity());
        
        RFQ savedRFQ = rfqRepository.save(rfq);
        
        RFQPublishedEvent event = RFQPublishedEvent.builder()
            .rfqId(savedRFQ.getRfqId())
            .title(savedRFQ.getTitle())
            .deadline(savedRFQ.getDeadline())
            .estimatedValue(savedRFQ.getEstimatedValue())
            .categoryId(savedRFQ.getCategoryId())
            .publishedAt(LocalDateTime.now())
            .build();
        
        kafkaTemplate.send("rfq.published", event);
        log.info("RFQ created and published: {}", savedRFQ.getRfqId());
        
        return mapToRFQResponse(savedRFQ);
    }
    
    public List<RFQResponse> getAllRFQs() {
        return rfqRepository.findAll().stream()
            .map(this::mapToRFQResponse)
            .collect(Collectors.toList());
    }
    
    public List<RFQResponse> getRFQsByStatus(String status) {
        return rfqRepository.findByStatus(status).stream()
            .map(this::mapToRFQResponse)
            .collect(Collectors.toList());
    }
    
    public RFQResponse getRFQ(Long rfqId) {
        RFQ rfq = rfqRepository.findById(rfqId)
            .orElseThrow(() -> new RuntimeException("RFQ not found"));
        return mapToRFQResponse(rfq);
    }
    
    @Transactional
    public RFQResponse updateRFQ(Long rfqId, RFQRequest request) {
        RFQ rfq = rfqRepository.findById(rfqId)
            .orElseThrow(() -> new RuntimeException("RFQ not found"));
        
        if (!"Open".equals(rfq.getStatus())) {
            throw new RuntimeException("Cannot update closed or awarded RFQ");
        }
        
        rfq.setTitle(request.getTitle());
        rfq.setDescription(request.getDescription());
        rfq.setDeadline(request.getDeadline());
        rfq.setEstimatedValue(request.getEstimatedValue());
        rfq.setCategoryId(request.getCategoryId());
        rfq.setExpectedQuantity(request.getExpectedQuantity());
        
        RFQ updatedRFQ = rfqRepository.save(rfq);
        log.info("RFQ updated: {}", rfqId);
        
        return mapToRFQResponse(updatedRFQ);
    }
    
    @Transactional
    public RFQResponse closeRFQ(Long rfqId) {
        RFQ rfq = rfqRepository.findById(rfqId)
            .orElseThrow(() -> new RuntimeException("RFQ not found"));
        
        rfq.setStatus("Closed");
        RFQ closedRFQ = rfqRepository.save(rfq);
        log.info("RFQ closed: {}", rfqId);
        
        return mapToRFQResponse(closedRFQ);
    }
    
    @Transactional
    public BidResponse submitBid(BidRequest request) {
        RFQ rfq = rfqRepository.findById(request.getRfqId())
            .orElseThrow(() -> new RuntimeException("RFQ not found"));
        
        if (!"Open".equals(rfq.getStatus())) {
            throw new RuntimeException("RFQ is not open for bidding");
        }
        
        if (LocalDateTime.now().isAfter(rfq.getDeadline())) {
            throw new RuntimeException("RFQ deadline has passed");
        }
        
        Bid bid = new Bid();
        bid.setRfqId(request.getRfqId());
        bid.setVendorId(request.getVendorId());
        bid.setBidAmount(request.getBidAmount());
        bid.setStatus("Pending");
        bid.setSubmittedAt(LocalDateTime.now());
        bid.setProposalText(request.getProposalText());
        bid.setDeliveryDays(request.getDeliveryDays());
        
        Bid savedBid = bidRepository.save(bid);
        
        BidSubmittedEvent event = BidSubmittedEvent.builder()
            .bidId(savedBid.getBidId())
            .rfqId(savedBid.getRfqId())
            .vendorId(savedBid.getVendorId())
            .bidAmount(savedBid.getBidAmount())
            .submittedAt(savedBid.getSubmittedAt())
            .build();
        
        kafkaTemplate.send("bid.submitted", event);
        log.info("Bid submitted: {} for RFQ: {}", savedBid.getBidId(), request.getRfqId());
        
        return mapToBidResponse(savedBid);
    }
    
    public List<BidResponse> getBidsByRFQ(Long rfqId) {
        return bidRepository.findByRfqId(rfqId).stream()
            .map(this::mapToBidResponse)
            .collect(Collectors.toList());
    }
    
    public List<BidResponse> getBidsByVendor(Long vendorId) {
        return bidRepository.findByVendorId(vendorId).stream()
            .map(this::mapToBidResponse)
            .collect(Collectors.toList());
    }
    
    @Transactional
    public BidResponse evaluateBid(Long bidId) {
        Bid bid = bidRepository.findById(bidId)
            .orElseThrow(() -> new RuntimeException("Bid not found"));
        
        RFQ rfq = rfqRepository.findById(bid.getRfqId())
            .orElseThrow(() -> new RuntimeException("RFQ not found"));
        
        if (LocalDateTime.now().isBefore(rfq.getDeadline())) {
            throw new RuntimeException("Cannot evaluate before deadline");
        }
        
        // Get all bids for this RFQ to calculate relative scores
        List<Bid> allBids = bidRepository.findByRfqId(bid.getRfqId());
        BigDecimal lowestBid = allBids.stream()
            .map(Bid::getBidAmount)
            .min(BigDecimal::compareTo)
            .orElse(bid.getBidAmount());
        
        // Calculate scores
        // Cost score: (lowestBid / currentBid) * 100
        BigDecimal costScore = lowestBid.divide(bid.getBidAmount(), 4, RoundingMode.HALF_UP)
            .multiply(BigDecimal.valueOf(100));
        
        // Timeliness score based on delivery days (shorter is better)
        BigDecimal timelinessScore = BigDecimal.valueOf(100);
        if (bid.getDeliveryDays() != null && bid.getDeliveryDays() > 0) {
            timelinessScore = BigDecimal.valueOf(Math.max(0, 100 - bid.getDeliveryDays() * 2));
        }
        
        // Quality score (default 80 if not set)
        BigDecimal qualityScore = bid.getQualityScore() != null ? bid.getQualityScore() : BigDecimal.valueOf(80);
        
        // Responsiveness score (default 90)
        BigDecimal responsivenessScore = BigDecimal.valueOf(90);
        
        // Weighted total score: Timeliness 35%, Quality 35%, Cost 20%, Responsiveness 10%
        BigDecimal totalScore = timelinessScore.multiply(BigDecimal.valueOf(0.35))
            .add(qualityScore.multiply(BigDecimal.valueOf(0.35)))
            .add(costScore.multiply(BigDecimal.valueOf(0.20)))
            .add(responsivenessScore.multiply(BigDecimal.valueOf(0.10)));
        
        bid.setQualityScore(qualityScore);
        bid.setTotalScore(totalScore);
        
        Bid evaluatedBid = bidRepository.save(bid);
        log.info("Bid evaluated: {} with score: {}", bidId, totalScore);
        
        return mapToBidResponse(evaluatedBid);
    }
    
    public List<BidResponse> getRankedBids(Long rfqId) {
        return bidRepository.findByRfqIdOrderByTotalScoreDesc(rfqId).stream()
            .map(this::mapToBidResponse)
            .collect(Collectors.toList());
    }
    
    @Transactional
    public void checkAndCloseExpiredRFQs() {
        List<RFQ> expiredRFQs = rfqRepository.findByStatusAndDeadlineBefore("Open", LocalDateTime.now());
        
        for (RFQ rfq : expiredRFQs) {
            rfq.setStatus("Closed");
            rfqRepository.save(rfq);
            log.info("RFQ auto-closed due to deadline: {}", rfq.getRfqId());
        }
    }
    
    private RFQResponse mapToRFQResponse(RFQ rfq) {
        return RFQResponse.builder()
            .rfqId(rfq.getRfqId())
            .title(rfq.getTitle())
            .description(rfq.getDescription())
            .deadline(rfq.getDeadline())
            .status(rfq.getStatus())
            .createdBy(rfq.getCreatedBy())
            .createdAt(rfq.getCreatedAt())
            .estimatedValue(rfq.getEstimatedValue())
            .categoryId(rfq.getCategoryId())
            .expectedQuantity(rfq.getExpectedQuantity())
            .build();
    }
    
    private BidResponse mapToBidResponse(Bid bid) {
        return BidResponse.builder()
            .bidId(bid.getBidId())
            .rfqId(bid.getRfqId())
            .vendorId(bid.getVendorId())
            .bidAmount(bid.getBidAmount())
            .status(bid.getStatus())
            .submittedAt(bid.getSubmittedAt())
            .proposalText(bid.getProposalText())
            .deliveryDays(bid.getDeliveryDays())
            .qualityScore(bid.getQualityScore())
            .totalScore(bid.getTotalScore())
            .build();
    }
}
