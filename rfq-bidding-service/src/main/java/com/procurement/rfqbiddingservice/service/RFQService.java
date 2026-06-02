package com.procurement.rfqbiddingservice.service;

import com.procurement.rfqbiddingservice.dto.*;
import com.procurement.rfqbiddingservice.entity.Bid;
import com.procurement.rfqbiddingservice.entity.RFQ;
import com.procurement.rfqbiddingservice.event.BidSubmittedEvent;
import com.procurement.rfqbiddingservice.event.RFQPublishedEvent;
import com.procurement.rfqbiddingservice.infrastructure.client.CategoryClient;
import com.procurement.rfqbiddingservice.infrastructure.client.ScoringClient;
import com.procurement.rfqbiddingservice.infrastructure.client.VendorClient;
import com.procurement.rfqbiddingservice.repository.BidRepository;
import com.procurement.rfqbiddingservice.repository.RFQRepository;
import com.procurement.rfqbiddingservice.repository.RFQSpecifications;
import com.procurement.rfqbiddingservice.tenant.TenantContext;
import com.procurement.rfqbiddingservice.workflow.BidStatus;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.CannotAcquireLockException;
import org.springframework.dao.DeadlockLoserDataAccessException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.util.StringUtils;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.hibernate.Session;
import org.hibernate.Filter;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.retry.annotation.Backoff;
import org.springframework.retry.annotation.Retryable;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Objects;
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
    private final ScoringClient scoringClient;

    @PersistenceContext
    private EntityManager entityManager;
    
    @Transactional
    public RFQResponse createRFQ(RFQRequest request, Long userId) {
        RFQ rfq = new RFQ();
        Long tenantId = TenantContext.getCurrentTenant();
        if (tenantId == null) {
            throw new IllegalStateException("Tenant context is required. Ensure request is authenticated.");
        }
        rfq.setTenantId(tenantId);
        rfq.setTitle(request.getTitle());
        rfq.setDescription(request.getDescription());
        rfq.setDeadline(request.getDeadline());
        rfq.setStatus("Open");
        rfq.setCreatedBy(userId);
        rfq.setCreatedAt(LocalDateTime.now());
        rfq.setEstimatedValue(request.getEstimatedValue());
        rfq.setCategoryId(request.getCategoryId());
        rfq.setExpectedQuantity(request.getExpectedQuantity());
        rfq.setRequisitionId(request.getRequisitionId());
        
        RFQ savedRFQ = rfqRepository.save(rfq);

        // Collect emails of active vendors matching this RFQ's category for email notifications
        List<String> vendorEmails = resolveVendorEmailsForRFQ(tenantId, savedRFQ.getCategoryId());

        RFQPublishedEvent event = RFQPublishedEvent.builder()
            .tenantId(tenantId)
            .rfqId(savedRFQ.getRfqId())
            .title(savedRFQ.getTitle())
            .deadline(savedRFQ.getDeadline())
            .estimatedValue(savedRFQ.getEstimatedValue())
            .categoryId(savedRFQ.getCategoryId())
            .publishedAt(LocalDateTime.now())
            .vendorEmails(vendorEmails)
            .build();

        kafkaTemplate.send("rfq.published", event)
            .whenComplete((result, ex) -> {
                if (ex != null) log.error("Failed to publish event to rfq.published: {}", ex.getMessage());
            });
        log.info("RFQ created and published: {} (notifying {} vendor(s))", savedRFQ.getRfqId(), vendorEmails.size());

        return mapToRFQResponse(savedRFQ, 0); // newly created — no bids yet
    }
    
    @Transactional(readOnly = true)
    public PagedResponse<RFQResponse> getAllRFQs(
            int page,
            int size,
            String search,
            String status,
            String statuses,
            Long categoryId,
            String sort) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        boolean isVendor = auth != null && auth.getAuthorities().stream()
            .anyMatch(a -> a.getAuthority().startsWith("ROLE_VENDOR"));

        String effectiveStatus = status;
        if (isVendor && !StringUtils.hasText(status) && !StringUtils.hasText(statuses)) {
            effectiveStatus = "Open";
        }

        Specification<RFQ> spec = RFQSpecifications.combine(
            search, effectiveStatus, statuses, categoryId);
        Page<RFQ> rfqPage = queryRfqs(
            spec, PageRequest.of(page, size, resolveRfqSort(sort)), isVendor);

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

    private Page<RFQ> queryRfqs(Specification<RFQ> spec, PageRequest pageable, boolean bypassTenantFilter) {
        if (!bypassTenantFilter) {
            return rfqRepository.findAll(spec, pageable);
        }
        Session session = entityManager.unwrap(Session.class);
        Filter tenantFilter = session.getEnabledFilter("tenantFilter");
        if (tenantFilter != null) {
            session.disableFilter("tenantFilter");
        }
        try {
            return rfqRepository.findAll(spec, pageable);
        } finally {
            if (tenantFilter != null) {
                Long tenantId = TenantContext.getCurrentTenant();
                if (tenantId != null) {
                    session.enableFilter("tenantFilter").setParameter("tenantId", tenantId);
                }
            }
        }
    }

    private Sort resolveRfqSort(String sort) {
        if (sort == null || sort.isBlank()) {
            return Sort.by(Sort.Direction.DESC, "createdAt");
        }
        return switch (sort) {
            case "deadline-asc" -> Sort.by(Sort.Direction.ASC, "deadline");
            case "deadline-desc" -> Sort.by(Sort.Direction.DESC, "deadline");
            case "value-asc" -> Sort.by(Sort.Direction.ASC, "estimatedValue");
            case "value-desc" -> Sort.by(Sort.Direction.DESC, "estimatedValue");
            case "title-asc" -> Sort.by(Sort.Direction.ASC, "title");
            default -> Sort.by(Sort.Direction.DESC, "createdAt");
        };
    }

    @Transactional(readOnly = true)
    public List<RFQResponse> getRFQsByStatus(String status) {
        List<RFQ> rfqs = rfqRepository.findByStatus(status);
        Map<Long, Integer> bidCounts = getBidCountMap(rfqs);
        return rfqs.stream()
            .map(rfq -> mapToRFQResponse(rfq, bidCounts.getOrDefault(rfq.getRfqId(), 0)))
            .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public RFQResponse getRFQ(Long rfqId) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        boolean isVendor = auth != null && auth.getAuthorities().stream()
            .anyMatch(a -> a.getAuthority().startsWith("ROLE_VENDOR"));
        RFQ rfq = isVendor
            ? rfqRepository.findByIdNative(rfqId).orElseThrow(() -> new RuntimeException("RFQ not found"))
            : rfqRepository.findById(rfqId).orElseThrow(() -> new RuntimeException("RFQ not found"));
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
        if (request.getRequisitionId() != null) {
            rfq.setRequisitionId(request.getRequisitionId());
        }
        
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
    public RFQResponse cancelRFQ(Long rfqId) {
        RFQ rfq = rfqRepository.findById(rfqId)
            .orElseThrow(() -> new RuntimeException("RFQ not found"));

        if ("Awarded".equals(rfq.getStatus())) {
            throw new RuntimeException("Cannot cancel an awarded RFQ");
        }
        if ("Cancelled".equals(rfq.getStatus())) {
            throw new RuntimeException("RFQ is already cancelled");
        }

        rfq.setStatus("Cancelled");
        RFQ cancelled = rfqRepository.save(rfq);
        log.info("RFQ cancelled: {}", rfqId);

        int bidCount = bidRepository.findByRfqId(rfqId).size();
        return mapToRFQResponse(cancelled, bidCount);
    }

    @Transactional(readOnly = true)
    public BidResponse getWinningBid(Long rfqId) {
        return bidRepository.findByRfqId(rfqId).stream()
            .filter(b -> BidStatus.AWARDED.equals(b.getStatus()))
            .findFirst()
            .map(this::mapToBidResponse)
            .orElseThrow(() -> new RuntimeException("No awarded bid found for RFQ: " + rfqId));
    }
    
    @Retryable(
        retryFor = { CannotAcquireLockException.class, DeadlockLoserDataAccessException.class },
        maxAttempts = 3,
        backoff = @Backoff(delay = 100, multiplier = 2)
    )
    @Transactional
    public BidResponse submitBid(BidRequest request, Long userId) {
        // Pessimistic lock prevents accepting bids on a concurrently-closing RFQ.
        // Native query bypasses Hibernate tenant filter so vendors from a different
        // tenant can lock and bid on a buyer's RFQ.
        RFQ rfq = rfqRepository.findByIdForUpdateNative(request.getRfqId())
            .orElseThrow(() -> new RuntimeException("RFQ not found"));

        Long tenantId = TenantContext.getCurrentTenant();
        if (tenantId == null) {
            throw new IllegalStateException("Tenant context is required. Ensure request is authenticated.");
        }
        // Vendors may belong to a different tenant than the buyer who issued the RFQ.
        // We store the bid under the RFQ's own tenantId so the buyer can see it.

        if (!"Open".equals(rfq.getStatus())) {
            throw new RuntimeException("RFQ is not open for bidding");
        }

        if (LocalDateTime.now().isAfter(rfq.getDeadline())) {
            throw new RuntimeException("RFQ deadline has passed");
        }

        // Derive vendorId from the authenticated user's profile — never trust request body
        Long resolvedVendorId = null;
        if (userId != null) {
            try {
                Map<String, Object> vendorProfile = vendorClient.getVendorByUserId(userId);
                if (vendorProfile != null && vendorProfile.get("vendorId") != null) {
                    resolvedVendorId = ((Number) vendorProfile.get("vendorId")).longValue();
                }
            } catch (Exception e) {
                log.warn("Could not resolve vendor profile for userId {}: {}", userId, e.getMessage());
            }
        }
        if (resolvedVendorId == null) {
            // Fallback to request body only if profile lookup fails (e.g., buyer submitting on behalf)
            resolvedVendorId = request.getVendorId();
        }

        // Only verified vendors are allowed to place bids
        if (resolvedVendorId != null) {
            try {
                Map<String, Object> vendorData = vendorClient.getVendorById(resolvedVendorId);
                if (vendorData != null) {
                    Object complianceStatus = vendorData.get("complianceStatus");
                    if (!"Verified".equals(complianceStatus)) {
                        throw new RuntimeException(
                            "Only verified vendors may submit bids. Current status: " + complianceStatus +
                            ". Please complete verification before bidding.");
                    }
                }
            } catch (RuntimeException re) {
                throw re;
            } catch (Exception e) {
                log.warn("Could not verify vendor compliance status for vendorId {}: {}", resolvedVendorId, e.getMessage());
            }
        }

        Bid bid = new Bid();
        bid.setTenantId(rfq.getTenantId()); // use buyer's tenantId so buyer can query this bid
        bid.setRfqId(request.getRfqId());
        bid.setVendorId(resolvedVendorId);
        bid.setBidAmount(request.getBidAmount());
        bid.setStatus(BidStatus.SUBMITTED);
        bid.setSubmittedAt(LocalDateTime.now());
        bid.setProposalText(request.getProposalText());
        bid.setDeliveryDays(request.getDeliveryDays());
        
        Bid savedBid = bidRepository.save(bid);
        
        String vendorName = null;
        try {
            Map<String, Object> vendorData = vendorClient.getVendorById(savedBid.getVendorId());
            if (vendorData != null) vendorName = (String) vendorData.get("companyName");
        } catch (Exception e) {
            log.warn("Could not fetch vendor name for bid event: {}", e.getMessage());
        }
        BidSubmittedEvent event = BidSubmittedEvent.builder()
            .tenantId(tenantId)
            .bidId(savedBid.getBidId())
            .rfqId(savedBid.getRfqId())
            .vendorId(savedBid.getVendorId())
            .bidAmount(savedBid.getBidAmount())
            .submittedAt(savedBid.getSubmittedAt())
            .vendorName(vendorName)
            .rfqTitle(rfq.getTitle())
            .build();
        
        kafkaTemplate.send("bid.submitted", event)
            .whenComplete((result, ex) -> {
                if (ex != null) log.error("Failed to publish event to bid.submitted: {}", ex.getMessage());
            });
        log.info("Bid submitted: {} for RFQ: {}", savedBid.getBidId(), request.getRfqId());
        
        return mapToBidResponse(savedBid);
    }
    
    @Transactional(readOnly = true)
    public List<BidResponse> getBidsByRFQ(Long rfqId) {
        return bidRepository.findByRfqId(rfqId).stream()
            .map(this::mapToBidResponse)
            .collect(Collectors.toList());
    }

    /** Returns only the bids that belong to the given vendor for an RFQ — used when caller is a vendor role. */
    @Transactional(readOnly = true)
    public List<BidResponse> getBidsByRFQForVendor(Long rfqId, Long userId) {
        Long vendorId = null;
        try {
            Map<String, Object> vendorProfile = vendorClient.getVendorByUserId(userId);
            if (vendorProfile != null && vendorProfile.get("vendorId") != null) {
                vendorId = ((Number) vendorProfile.get("vendorId")).longValue();
            }
        } catch (Exception e) {
            log.warn("Could not resolve vendorId for bid visibility check, userId {}: {}", userId, e.getMessage());
        }
        if (vendorId == null) return List.of();
        final Long fVendorId = vendorId;
        // Use the cross-tenant vendor lookup so the filter does not block bids stored
        // under the buyer's tenantId (which differs from the vendor's tenantId).
        return bidRepository.findByVendorIdAllTenants(vendorId).stream()
            .filter(b -> rfqId.equals(b.getRfqId()))
            .map(this::mapToBidResponse)
            .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public BidResponse getBidById(Long bidId) {
        Bid bid = bidRepository.findById(bidId)
            .orElseThrow(() -> new RuntimeException("Bid not found: " + bidId));
        return mapToBidResponse(bid);
    }
    
    @Transactional(readOnly = true)
    public List<BidResponse> getBidsByVendor(Long vendorId) {
        // Use native query to find vendor's bids regardless of which buyer tenant the bid is stored in.
        return bidRepository.findByVendorIdAllTenants(vendorId).stream()
            .map(this::mapToBidResponse)
            .collect(Collectors.toList());
    }
    
    @Transactional
    public BidResponse evaluateBid(Long bidId) {
        Bid bid = bidRepository.findById(bidId)
            .orElseThrow(() -> new RuntimeException("Bid not found"));
        
        RFQ rfq = rfqRepository.findById(bid.getRfqId())
            .orElseThrow(() -> new RuntimeException("RFQ not found"));
        
        boolean rfqClosed = "Closed".equalsIgnoreCase(rfq.getStatus()) || "Awarded".equalsIgnoreCase(rfq.getStatus());
        if (!rfqClosed && LocalDateTime.now().isBefore(rfq.getDeadline())) {
            throw new RuntimeException("Cannot evaluate before deadline");
        }
        
        // Get all bids for this RFQ to calculate relative scores
        List<Bid> allBids = bidRepository.findByRfqId(bid.getRfqId());
        BigDecimal bidAmount = bid.getBidAmount();
        BigDecimal lowestBid = allBids.stream()
            .map(Bid::getBidAmount)
            .filter(Objects::nonNull)
            .min(BigDecimal::compareTo)
            .orElse(bidAmount != null ? bidAmount : BigDecimal.ONE);

        // Calculate scores
        // Cost score: (lowestBid / currentBid) * 100; 100 if no bid amount
        BigDecimal costScore;
        if (bidAmount == null || bidAmount.compareTo(BigDecimal.ZERO) == 0) {
            costScore = BigDecimal.valueOf(100);
        } else {
            costScore = lowestBid.divide(bidAmount, 4, RoundingMode.HALF_UP)
                .multiply(BigDecimal.valueOf(100));
        }
        
        // Timeliness score based on delivery days (shorter is better)
        BigDecimal timelinessScore = BigDecimal.valueOf(100);
        if (bid.getDeliveryDays() != null && bid.getDeliveryDays() > 0) {
            timelinessScore = BigDecimal.valueOf(Math.max(0, 100 - bid.getDeliveryDays() * 2));
        }
        
        // Quality and responsiveness scores from vendor performance history
        BigDecimal qualityScore = bid.getQualityScore() != null ? bid.getQualityScore() : BigDecimal.valueOf(80);
        BigDecimal responsivenessScore = BigDecimal.valueOf(80);
        try {
            Map<String, Object> perf = scoringClient.getVendorPerformance(bid.getVendorId());
            if (perf != null) {
                Object qs = perf.get("qualityScore");
                Object rs = perf.get("responsivenessScore");
                if (qs != null) qualityScore = new BigDecimal(qs.toString());
                if (rs != null) responsivenessScore = new BigDecimal(rs.toString());
            }
        } catch (Exception ex) {
            log.warn("Could not fetch vendor performance for scoring, using defaults: {}", ex.getMessage());
        }
        
        // Weighted total score: Timeliness 35%, Quality 35%, Cost 20%, Responsiveness 10%
        BigDecimal totalScore = timelinessScore.multiply(BigDecimal.valueOf(0.35))
            .add(qualityScore.multiply(BigDecimal.valueOf(0.35)))
            .add(costScore.multiply(BigDecimal.valueOf(0.20)))
            .add(responsivenessScore.multiply(BigDecimal.valueOf(0.10)));
        
        bid.setQualityScore(qualityScore);
        bid.setTotalScore(totalScore);
        if (!BidStatus.AWARDED.equals(bid.getStatus()) && !BidStatus.REJECTED.equals(bid.getStatus())) {
            bid.setStatus(BidStatus.EVALUATED);
        }
        
        Bid evaluatedBid = bidRepository.save(bid);
        log.info("Bid evaluated: {} with score: {}", bidId, totalScore);
        
        return mapToBidResponse(evaluatedBid);
    }
    
    /** Evaluates all submitted bids for an RFQ in one call. Skips already-evaluated bids. */
    @Transactional
    public List<BidResponse> evaluateAllBids(Long rfqId) {
        return bidRepository.findByRfqId(rfqId).stream()
            .filter(b -> BidStatus.isEvaluable(b.getStatus()))
            .map(b -> evaluateBid(b.getBidId()))
            .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<BidResponse> getRankedBids(Long rfqId) {
        return bidRepository.findByRfqIdOrderByTotalScoreDesc(rfqId).stream()
            .map(this::mapToBidResponse)
            .collect(Collectors.toList());
    }

    @Retryable(
        retryFor = { CannotAcquireLockException.class, DeadlockLoserDataAccessException.class },
        maxAttempts = 3,
        backoff = @Backoff(delay = 100, multiplier = 2)
    )
    @Transactional
    public BidResponse awardBid(Long bidId) {
        Bid bid = bidRepository.findById(bidId)
            .orElseThrow(() -> new RuntimeException("Bid not found"));

        // Auto-evaluate any unevaluated bids before awarding so callers don't need a separate step
        boolean anyEvaluated = bidRepository.findByRfqId(bid.getRfqId()).stream()
            .anyMatch(b -> b.getTotalScore() != null);
        if (!anyEvaluated) {
            log.info("No evaluated bids found for RFQ {}; auto-evaluating before award", bid.getRfqId());
            evaluateAllBids(bid.getRfqId());
            // Re-fetch bid after evaluation so it has the updated totalScore
            bid = bidRepository.findById(bidId)
                .orElseThrow(() -> new RuntimeException("Bid not found"));
        }

        bid.setStatus(BidStatus.AWARDED);
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
    
    @Scheduled(cron = "0 */5 * * * *")
    @Transactional
    public void checkAndCloseExpiredRFQs() {
        List<RFQ> expiredRFQs = rfqRepository.findByStatusAndDeadlineBefore("Open", LocalDateTime.now());
        
        for (RFQ rfq : expiredRFQs) {
            rfq.setStatus("Closed");
            rfqRepository.save(rfq);
            log.info("RFQ auto-closed due to deadline: {}", rfq.getRfqId());
        }
    }
    
    /** Looks up emails of ACTIVE vendors for the given tenant, optionally filtered by category. */
    private List<String> resolveVendorEmailsForRFQ(Long tenantId, Long categoryId) {
        try {
            List<Long> vendorIds = vendorClient.getVendorIdsByTenantId(tenantId);
            if (vendorIds == null || vendorIds.isEmpty()) return List.of();
            List<Map<String, Object>> vendors = vendorClient.getVendorsByIds(vendorIds);
            if (vendors == null) return List.of();
            return vendors.stream()
                .filter(v -> {
                    Object status = v.get("complianceStatus");
                    if (status == null) return false;
                    String s = status.toString().toUpperCase();
                    return s.contains("ACTIVE") || s.contains("VERIFIED") || s.contains("APPROVED");
                })
                .filter(v -> {
                    if (categoryId == null) return true;
                    Object cat = v.get("categoryId");
                    return cat != null && Long.parseLong(cat.toString()) == categoryId;
                })
                .map(v -> {
                    Object email = v.get("email");
                    return email != null ? email.toString() : null;
                })
                .filter(Objects::nonNull)
                .collect(Collectors.toList());
        } catch (Exception e) {
            log.warn("Could not resolve vendor emails for rfq notification (non-fatal): {}", e.getMessage());
            return List.of();
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
            .requisitionId(rfq.getRequisitionId())
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


