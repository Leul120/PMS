package com.procurement.rfqbiddingservice.service;

import com.procurement.rfqbiddingservice.dto.*;
import com.procurement.rfqbiddingservice.entity.Bid;
import com.procurement.rfqbiddingservice.entity.RFQ;
import com.procurement.rfqbiddingservice.event.BidSubmittedEvent;
import com.procurement.rfqbiddingservice.event.RFQPublishedEvent;
import com.procurement.rfqbiddingservice.infrastructure.client.CategoryClient;
import com.procurement.rfqbiddingservice.infrastructure.client.VendorClient;
import com.procurement.rfqbiddingservice.repository.BidRepository;
import com.procurement.rfqbiddingservice.repository.RFQRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class RFQService {
    
    private final RFQRepository rfqRepository;
    private final BidRepository bidRepository;
    private final KafkaTemplate<String, Object> kafkaTemplate;
    private final VendorClient vendorClient;
    private final CategoryClient categoryClient;
    
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

        return mapToRFQResponse(savedRFQ, 0); // newly created — no bids yet
    }
    
    public PagedResponse<RFQResponse> getAllRFQs(int page, int size) {
        Page<RFQ> rfqPage = rfqRepository.findAll(
            PageRequest.of(page, size, Sort.unsorted()));
        List<RFQ> rfqs = rfqPage.getContent();
        Map<Long, Integer> bidCounts = getBidCountMap(rfqs);
        List<RFQResponse> content = rfqs.stream()
            .map(rfq -> mapToRFQResponse(rfq, bidCounts.getOrDefault(rfq.getRfqId(), 0)))
            .collect(Collectors.toList());
        return PagedResponse.<RFQResponse>builder()
            .content(content).page(rfqPage.getNumber()).size(rfqPage.getSize())
            .totalElements(rfqPage.getTotalElements()).totalPages(rfqPage.getTotalPages())
            .last(rfqPage.isLast()).build();
    }

    public List<RFQResponse> getRFQsByStatus(String status) {
        List<RFQ> rfqs = rfqRepository.findByStatus(status);
        Map<Long, Integer> bidCounts = getBidCountMap(rfqs);
        return rfqs.stream()
            .map(rfq -> mapToRFQResponse(rfq, bidCounts.getOrDefault(rfq.getRfqId(), 0)))
            .collect(Collectors.toList());
    }

    public RFQResponse getRFQ(Long rfqId) {
        RFQ rfq = rfqRepository.findById(rfqId)
            .orElseThrow(() -> new RuntimeException("RFQ not found"));
        int bidCount = bidRepository.findByRfqId(rfqId).size();
        return mapToRFQResponse(rfq, bidCount);
    }

    /** Single query to get bid counts for all RFQs — eliminates N+1. */
    private Map<Long, Integer> getBidCountMap(List<RFQ> rfqs) {
        if (rfqs.isEmpty()) return Map.of();
        List<Long> rfqIds = rfqs.stream().map(RFQ::getRfqId).collect(Collectors.toList());
        Map<Long, Integer> counts = new java.util.HashMap<>();
        bidRepository.countBidsByRfqIds(rfqIds).forEach(row -> {
            Long id = ((Number) row.get("rfqId")).longValue();
            Integer count = ((Number) row.get("bidCount")).intValue();
            counts.put(id, count);
        });
        return counts;
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

        int bidCount = bidRepository.findByRfqId(rfqId).size();
        return mapToRFQResponse(updatedRFQ, bidCount);
    }

    @Transactional
    public RFQResponse closeRFQ(Long rfqId) {
        RFQ rfq = rfqRepository.findById(rfqId)
            .orElseThrow(() -> new RuntimeException("RFQ not found"));

        rfq.setStatus("Closed");
        RFQ closedRFQ = rfqRepository.save(rfq);
        log.info("RFQ closed: {}", rfqId);

        int bidCount = bidRepository.findByRfqId(rfqId).size();
        return mapToRFQResponse(closedRFQ, bidCount);
    }
    
    @Transactional
    public BidResponse submitBid(BidRequest request) {
        // Pessimistic lock prevents accepting bids on a concurrently-closing RFQ
        RFQ rfq = rfqRepository.findByIdForUpdate(request.getRfqId())
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

    public BidResponse getBidById(Long bidId) {
        Bid bid = bidRepository.findById(bidId)
            .orElseThrow(() -> new RuntimeException("Bid not found: " + bidId));
        return mapToBidResponse(bid);
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
    public BidResponse awardBid(Long bidId) {
        Bid bid = bidRepository.findById(bidId)
            .orElseThrow(() -> new RuntimeException("Bid not found"));

        bid.setStatus("Awarded");
        Bid awardedBid = bidRepository.save(bid);

        rfqRepository.findById(bid.getRfqId()).ifPresent(rfq -> {
            rfq.setStatus("Awarded");
            rfqRepository.save(rfq);
        });

        // Single bulk UPDATE instead of N individual saves
        bidRepository.rejectOtherBids(bid.getRfqId(), bidId);

        log.info("Bid awarded: {} for RFQ: {}", bidId, bid.getRfqId());
        return mapToBidResponse(awardedBid);
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
    
    private RFQResponse mapToRFQResponse(RFQ rfq, int bidCount) {
        String rfqNumber = "RFQ-" + String.format("%06d", rfq.getRfqId());
        String categoryName = categoryClient.getCategoryName(rfq.getCategoryId());
        return RFQResponse.builder()
            .rfqId(rfq.getRfqId())
            .id(rfq.getRfqId())
            .rfqNumber(rfqNumber)
            .title(rfq.getTitle())
            .description(rfq.getDescription())
            .deadline(rfq.getDeadline())
            .status(rfq.getStatus())
            .createdBy(rfq.getCreatedBy())
            .createdAt(rfq.getCreatedAt())
            .estimatedValue(rfq.getEstimatedValue())
            .maxBudget(rfq.getEstimatedValue())
            .categoryId(rfq.getCategoryId())
            .categoryName(categoryName)
            .category(categoryName)
            .expectedQuantity(rfq.getExpectedQuantity())
            .bidCount(bidCount)
            .build();
    }
    
    private BidResponse mapToBidResponse(Bid bid) {
        String deliveryTime = bid.getDeliveryDays() != null ? bid.getDeliveryDays() + " days" : null;
        int scoreInt = bid.getTotalScore() != null ? bid.getTotalScore().intValue() : 0;
        String vendorName = vendorClient.getVendorName(bid.getVendorId());
        return BidResponse.builder()
            .bidId(bid.getBidId())
            .id(bid.getBidId())
            .rfqId(bid.getRfqId())
            .vendorId(bid.getVendorId())
            .vendorName(vendorName)
            .bidAmount(bid.getBidAmount())
            .status(bid.getStatus())
            .submittedAt(bid.getSubmittedAt())
            .proposalText(bid.getProposalText())
            .deliveryDays(bid.getDeliveryDays())
            .deliveryTime(deliveryTime)
            .qualityScore(bid.getQualityScore())
            .totalScore(bid.getTotalScore())
            .score(scoreInt)
            .build();
    }
}


