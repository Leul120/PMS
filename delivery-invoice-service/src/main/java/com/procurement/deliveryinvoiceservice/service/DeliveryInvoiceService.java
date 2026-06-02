package com.procurement.deliveryinvoiceservice.service;

import com.procurement.deliveryinvoiceservice.dto.*;
import com.procurement.deliveryinvoiceservice.entity.Delivery;
import com.procurement.deliveryinvoiceservice.entity.Dispute;
import com.procurement.deliveryinvoiceservice.entity.Invoice;
import com.procurement.deliveryinvoiceservice.entity.ThreeWayMatch;
import com.procurement.deliveryinvoiceservice.event.DeliveryCompletedEvent;
import com.procurement.deliveryinvoiceservice.event.InvoiceDiscrepancyEvent;
import com.procurement.deliveryinvoiceservice.event.InvoicePaidEvent;
import com.procurement.deliveryinvoiceservice.infrastructure.client.ProcurementClient;
import com.procurement.deliveryinvoiceservice.workflow.InvoiceStatus;
import com.procurement.deliveryinvoiceservice.repository.DeliveryRepository;
import com.procurement.deliveryinvoiceservice.repository.DeliverySpecifications;
import com.procurement.deliveryinvoiceservice.repository.DisputeRepository;
import com.procurement.deliveryinvoiceservice.repository.InvoiceRepository;
import com.procurement.deliveryinvoiceservice.repository.InvoiceSpecifications;
import com.procurement.deliveryinvoiceservice.repository.ThreeWayMatchRepository;
import com.procurement.deliveryinvoiceservice.tenant.TenantContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class DeliveryInvoiceService {
    
    private final DeliveryRepository deliveryRepository;
    private final InvoiceRepository invoiceRepository;
    private final ThreeWayMatchRepository threeWayMatchRepository;
    private final DisputeRepository disputeRepository;
    private final KafkaTemplate<String, Object> kafkaTemplate;
    private final ProcurementClient procurementClient;
    
    @Transactional
    public Delivery createDelivery(DeliveryRequest request) {
        Long poId = request.getPoId();
        Long vendorId = request.getVendorId();
        LocalDate expectedDate = request.getExpectedDate();
        LocalDate actualDate = request.getActualDate();
        Integer quantityDelivered = request.getQuantityDelivered();

        Delivery delivery = new Delivery();
        Long tenantId = TenantContext.getCurrentTenant();
        if (tenantId == null) {
            throw new IllegalStateException("Tenant context is required. Ensure request is authenticated.");
        }
        delivery.setTenantId(tenantId);
        delivery.setPoId(poId);
        delivery.setExpectedDate(expectedDate);
        delivery.setActualDate(actualDate);
        delivery.setQuantityDelivered(quantityDelivered);
        delivery.setQuantityOrdered(request.getQuantityOrdered());
        delivery.setDeliveryStatus("Delivered");
        delivery.setIssueNotes(request.getIssueNotes());
        delivery.setQualityRemarks(request.getQualityRemarks());
        delivery.setQualityRating(normaliseQualityRating(request.getQualityRating()));
        delivery.setQualityIssueTypes(normaliseIssueTypes(request.getQualityIssueTypes()));

        int delayDays = 0;
        int expectedDays = 30;
        if (actualDate != null && expectedDate != null && actualDate.isAfter(expectedDate)) {
            delayDays = (int) ChronoUnit.DAYS.between(expectedDate, actualDate);
        }
        delivery.setDelayDays(delayDays);

        Delivery savedDelivery = deliveryRepository.save(delivery);
        syncPoOnDelivery(savedDelivery, vendorId, delayDays, expectedDays);
        return savedDelivery;
    }

    private static String normaliseQualityRating(String rating) {
        if (rating == null || rating.isBlank()) {
            return null;
        }
        return rating.trim().toUpperCase();
    }

    private static String normaliseIssueTypes(String issues) {
        if (issues == null || issues.isBlank()) {
            return null;
        }
        return java.util.Arrays.stream(issues.split(","))
            .map(String::trim)
            .filter(s -> !s.isEmpty())
            .map(s -> s.toUpperCase())
            .distinct()
            .collect(Collectors.joining(","));
    }

    private void syncPoOnDelivery(Delivery delivery, Long vendorId, int delayDays, int expectedDays) {
        Long poId = delivery.getPoId();
        Long deliveryId = delivery.getDeliveryId();
        Long tenantId = delivery.getTenantId();

        try {
            procurementClient.updatePOStatus(poId, "Delivered");
            log.info("PO {} status set to Delivered after delivery {} completion", poId, deliveryId);
        } catch (Exception ex) {
            log.warn("Could not update PO {} status after delivery completion: {}", poId, ex.getMessage());
        }

        DeliveryCompletedEvent event = DeliveryCompletedEvent.builder()
            .tenantId(tenantId)
            .deliveryId(deliveryId)
            .poId(poId)
            .vendorId(vendorId)
            .delayDays(delayDays)
            .expectedDays(expectedDays)
            .quantityDelivered(delivery.getQuantityDelivered())
            .quantityOrdered(delivery.getQuantityOrdered())
            .qualityRemarks(delivery.getQualityRemarks())
            .qualityRating(delivery.getQualityRating())
            .qualityIssueTypes(delivery.getQualityIssueTypes())
            .completedAt(LocalDateTime.now())
            .build();

        kafkaTemplate.send("delivery.completed", event)
            .whenComplete((result, ex) -> {
                if (ex != null) log.error("Failed to publish event to delivery.completed: {}", ex.getMessage());
            });
        log.info("Delivery completed: {} for PO: {}", deliveryId, poId);
    }
    
    @Transactional(readOnly = true)
    public List<Delivery> getDeliveriesByPO(Long poId) {
        return deliveryRepository.findByPoId(poId);
    }

    @Transactional(readOnly = true)
    public PagedResponse<Delivery> getAllDeliveries(
            int page,
            int size,
            String search,
            String status,
            String statuses,
            String sort) {
        Specification<Delivery> spec = DeliverySpecifications.combine(search, status, statuses);
        Page<Delivery> p = deliveryRepository.findAll(
            spec, PageRequest.of(page, size, resolveDeliverySort(sort)));
        return PagedResponse.<Delivery>builder()
            .content(p.getContent()).page(p.getNumber()).size(p.getSize())
            .totalElements(p.getTotalElements()).totalPages(p.getTotalPages()).last(p.isLast()).build();
    }

    private Sort resolveDeliverySort(String sort) {
        if (sort == null || sort.isBlank()) {
            return Sort.by(Sort.Direction.DESC, "deliveryId");
        }
        return switch (sort) {
            case "date-asc" -> Sort.by(Sort.Direction.ASC, "expectedDate");
            case "date-desc" -> Sort.by(Sort.Direction.DESC, "expectedDate");
            case "id-asc" -> Sort.by(Sort.Direction.ASC, "deliveryId");
            default -> Sort.by(Sort.Direction.DESC, "deliveryId");
        };
    }
    
    @Transactional
    public Invoice submitInvoice(Long poId, BigDecimal invoiceAmount, Long vendorId) {
        Invoice invoice = new Invoice();
        Long tenantId = TenantContext.getCurrentTenant();
        if (tenantId == null) {
            throw new IllegalStateException("Tenant context is required. Ensure request is authenticated.");
        }
        invoice.setTenantId(tenantId);
        invoice.setPoId(poId);
        invoice.setVendorId(vendorId);
        invoice.setInvoiceAmount(invoiceAmount);
        invoice.setStatus(InvoiceStatus.PENDING);
        invoice.setInvoiceDate(LocalDate.now());
        invoice.setDiscrepancyFlag(false);
        
        Invoice savedInvoice = invoiceRepository.save(invoice);
        log.info("Invoice submitted: {} for PO: {}", savedInvoice.getInvoiceId(), poId);
        
        return savedInvoice;
    }
    
    @Transactional
    public Invoice validateInvoice(Long invoiceId, BigDecimal expectedAmount, Integer expectedQuantity) {
        Invoice invoice = invoiceRepository.findById(invoiceId)
            .orElseThrow(() -> new RuntimeException("Invoice not found"));

        // Require at least one confirmed delivery for the linked PO before approving
        if (invoice.getPoId() != null) {
            boolean hasConfirmedDelivery = deliveryRepository.findByPoId(invoice.getPoId()).stream()
                .anyMatch(d -> "Delivered".equalsIgnoreCase(d.getDeliveryStatus()));
            if (!hasConfirmedDelivery) {
                throw new RuntimeException(
                    "Cannot approve invoice: no confirmed delivery found for PO " + invoice.getPoId() +
                    ". Goods must be received before payment can be authorised.");
            }
        }

        // 3-way matching: Compare invoice amount with expected amount
        boolean hasDiscrepancy = false;
        String discrepancyReason = "";
        
        if (invoice.getInvoiceAmount().compareTo(expectedAmount) != 0) {
            hasDiscrepancy = true;
            discrepancyReason = "Amount mismatch: Invoice " + invoice.getInvoiceAmount() + 
                              " vs Expected " + expectedAmount;
        }
        
        if (hasDiscrepancy) {
            invoice.setDiscrepancyFlag(true);
            invoice.setStatus(InvoiceStatus.DISPUTED);
            invoice.setDiscrepancyReason(discrepancyReason);
            
            Invoice disputedInvoice = invoiceRepository.save(invoice);
            
            InvoiceDiscrepancyEvent event = InvoiceDiscrepancyEvent.builder()
                .tenantId(invoice.getTenantId())
                .invoiceId(invoiceId)
                .poId(invoice.getPoId())
                .invoiceAmount(invoice.getInvoiceAmount())
                .expectedAmount(expectedAmount)
                .discrepancyReason(discrepancyReason)
                .detectedAt(LocalDateTime.now())
                .build();
            
            kafkaTemplate.send("invoice.discrepancy", event)
                .whenComplete((result, ex) -> {
                    if (ex != null) log.error("Failed to publish event to invoice.discrepancy: {}", ex.getMessage());
                });
            log.info("Invoice discrepancy detected: {}", invoiceId);
            
            return disputedInvoice;
        } else {
            invoice.setStatus(InvoiceStatus.APPROVED);
            invoice.setDiscrepancyFlag(false);
            log.info("Invoice validated successfully: {}", invoiceId);
            return invoiceRepository.save(invoice);
        }
    }
    
    @Transactional
    public Invoice disputeInvoice(Long invoiceId, String reason) {
        Invoice invoice = invoiceRepository.findById(invoiceId)
            .orElseThrow(() -> new RuntimeException("Invoice not found"));
        
        invoice.setStatus(InvoiceStatus.DISPUTED);
        invoice.setDiscrepancyFlag(true);
        invoice.setDiscrepancyReason(reason);
        
        Invoice disputedInvoice = invoiceRepository.save(invoice);
        
        InvoiceDiscrepancyEvent event = InvoiceDiscrepancyEvent.builder()
            .tenantId(invoice.getTenantId())
            .invoiceId(invoiceId)
            .poId(invoice.getPoId())
            .invoiceAmount(invoice.getInvoiceAmount())
            .discrepancyReason(reason)
            .detectedAt(LocalDateTime.now())
            .build();
        
        kafkaTemplate.send("invoice.discrepancy", event)
            .whenComplete((result, ex) -> {
                if (ex != null) log.error("Failed to publish event to invoice.discrepancy: {}", ex.getMessage());
            });
        log.info("Invoice disputed: {} - Reason: {}", invoiceId, reason);
        
        return disputedInvoice;
    }
    
    @Transactional(readOnly = true)
    public List<Invoice> getInvoicesByPO(Long poId) {
        return invoiceRepository.findByPoId(poId);
    }

    @Transactional(readOnly = true)
    public List<Invoice> getInvoicesByVendor(Long vendorId) {
        return invoiceRepository.findByVendorId(vendorId);
    }

    private static final java.util.Map<String, String> DELIVERY_STATUS_MAP = java.util.Map.of(
        "pending", "Pending",
        "shipped", "Shipped",
        "in_transit", "In Transit",
        "intransit", "In Transit",
        "in transit", "In Transit",
        "delivered", "Delivered",
        "completed", "Delivered",
        "cancelled", "Cancelled",
        "canceled", "Cancelled"
    );

    @Transactional
    public Delivery updateDeliveryStatus(Long deliveryId, String status) {
        Delivery delivery = deliveryRepository.findById(deliveryId)
            .orElseThrow(() -> new RuntimeException("Delivery not found: " + deliveryId));

        String normalised = status == null ? "" : status.trim().toLowerCase();
        String canonical = DELIVERY_STATUS_MAP.get(normalised);
        if (canonical == null) {
            throw new RuntimeException(
                "Invalid delivery status '" + status + "'. Allowed: Pending, Shipped, In Transit, Delivered, Cancelled.");
        }
        delivery.setDeliveryStatus(canonical);
        Delivery updated = deliveryRepository.save(delivery);
        log.info("Delivery {} status updated to: {}", deliveryId, canonical);
        if ("Delivered".equals(canonical)) {
            Long poId = delivery.getPoId();
            Long vendorId = null;
            try {
                Map<String, Object> po = procurementClient.getPurchaseOrderById(poId);
                Object vendorIdObj = po.get("vendorId");
                vendorId = vendorIdObj != null ? Long.parseLong(vendorIdObj.toString()) : null;
            } catch (Exception ex) {
                log.warn("Could not resolve vendor for delivery {}: {}", deliveryId, ex.getMessage());
            }
            syncPoOnDelivery(updated, vendorId,
                delivery.getDelayDays() != null ? delivery.getDelayDays() : 0,
                30);
        }

        return updated;
    }
    
    @Transactional(readOnly = true)
    public PagedResponse<Invoice> getAllInvoices(
            int page,
            int size,
            String search,
            String status,
            String statuses,
            Long vendorId,
            String sort) {
        Specification<Invoice> spec = InvoiceSpecifications.combine(search, status, statuses, vendorId);
        Page<Invoice> p = invoiceRepository.findAll(
            spec, PageRequest.of(page, size, resolveInvoiceSort(sort)));
        return PagedResponse.<Invoice>builder()
            .content(p.getContent()).page(p.getNumber()).size(p.getSize())
            .totalElements(p.getTotalElements()).totalPages(p.getTotalPages()).last(p.isLast()).build();
    }

    private Sort resolveInvoiceSort(String sort) {
        if (sort == null || sort.isBlank()) {
            return Sort.by(Sort.Direction.DESC, "invoiceId");
        }
        return switch (sort) {
            case "amount-asc" -> Sort.by(Sort.Direction.ASC, "invoiceAmount");
            case "amount-desc" -> Sort.by(Sort.Direction.DESC, "invoiceAmount");
            case "date-asc" -> Sort.by(Sort.Direction.ASC, "invoiceDate");
            case "date-desc" -> Sort.by(Sort.Direction.DESC, "invoiceDate");
            case "id-asc" -> Sort.by(Sort.Direction.ASC, "invoiceId");
            default -> Sort.by(Sort.Direction.DESC, "invoiceId");
        };
    }
    
    @Transactional
    public ThreeWayMatchResponse performThreeWayMatch(Long poId, Long deliveryId, Long invoiceId,
                                                       BigDecimal poAmount, Integer poQuantity) {
        Delivery delivery = deliveryRepository.findById(deliveryId)
            .orElseThrow(() -> new RuntimeException("Delivery not found"));
        Invoice invoice = invoiceRepository.findById(invoiceId)
            .orElseThrow(() -> new RuntimeException("Invoice not found"));
        
        // Perform 3-way matching
        boolean quantityMatch = poQuantity.equals(delivery.getQuantityDelivered());
        boolean priceMatch = poAmount.compareTo(invoice.getInvoiceAmount()) == 0;
        
        String status = (quantityMatch && priceMatch) ? "MATCHED" : "MISMATCH";
        String mismatchReason = "";
        if (!quantityMatch) {
            mismatchReason += "Quantity mismatch: PO " + poQuantity + " vs Delivery " + delivery.getQuantityDelivered() + ". ";
        }
        if (!priceMatch) {
            mismatchReason += "Price mismatch: PO " + poAmount + " vs Invoice " + invoice.getInvoiceAmount();
        }
        
        ThreeWayMatch match = new ThreeWayMatch();
        Long tenantId = TenantContext.getCurrentTenant();
        if (tenantId == null) {
            throw new IllegalStateException("Tenant context is required. Ensure request is authenticated.");
        }
        match.setTenantId(tenantId);
        match.setPoId(poId);
        match.setDeliveryId(deliveryId);
        match.setInvoiceId(invoiceId);
        match.setPoAmount(poAmount);
        match.setPoQuantity(poQuantity);
        match.setInvoiceAmount(invoice.getInvoiceAmount());
        match.setDeliveryQuantity(delivery.getQuantityDelivered());
        match.setQuantityMatch(quantityMatch);
        match.setPriceMatch(priceMatch);
        match.setStatus(status);
        match.setMismatchReason(mismatchReason.isEmpty() ? null : mismatchReason);
        match.setValidatedAt(LocalDateTime.now());
        
        ThreeWayMatch savedMatch = threeWayMatchRepository.save(match);

        if ("MATCHED".equals(status)) {
            InvoiceStatus.validateTransition(invoice.getStatus(), InvoiceStatus.APPROVED);
            invoice.setStatus(InvoiceStatus.APPROVED);
            invoice.setDiscrepancyFlag(false);
            invoice.setDiscrepancyReason(null);
            invoiceRepository.save(invoice);
            log.info("Invoice {} approved via 3-way match for PO {}", invoiceId, poId);
        } else {
            InvoiceStatus.validateTransition(invoice.getStatus(), InvoiceStatus.DISPUTED);
            invoice.setStatus(InvoiceStatus.DISPUTED);
            invoice.setDiscrepancyFlag(true);
            invoice.setDiscrepancyReason(mismatchReason.isEmpty() ? "3-way match mismatch" : mismatchReason);
            invoiceRepository.save(invoice);

            InvoiceDiscrepancyEvent event = InvoiceDiscrepancyEvent.builder()
                .tenantId(tenantId)
                .invoiceId(invoiceId)
                .poId(poId)
                .invoiceAmount(invoice.getInvoiceAmount())
                .expectedAmount(poAmount)
                .discrepancyReason(invoice.getDiscrepancyReason())
                .detectedAt(LocalDateTime.now())
                .build();
            kafkaTemplate.send("invoice.discrepancy", event)
                .whenComplete((result, ex) -> {
                    if (ex != null) log.error("Failed to publish event to invoice.discrepancy: {}", ex.getMessage());
                });
            log.info("Invoice {} disputed via 3-way match for PO {}", invoiceId, poId);
        }
        
        log.info("3-Way Match performed for PO {}: {}", poId, status);
        return mapToThreeWayMatchResponse(savedMatch);
    }

    @Transactional
    public Invoice markInvoicePaid(Long invoiceId, Long markedBy) {
        Invoice invoice = invoiceRepository.findById(invoiceId)
            .orElseThrow(() -> new RuntimeException("Invoice not found"));

        InvoiceStatus.validateTransition(invoice.getStatus(), InvoiceStatus.PAID);
        invoice.setStatus(InvoiceStatus.PAID);
        Invoice paid = invoiceRepository.save(invoice);

        InvoicePaidEvent event = InvoicePaidEvent.builder()
            .tenantId(invoice.getTenantId())
            .invoiceId(invoiceId)
            .poId(invoice.getPoId())
            .vendorId(invoice.getVendorId())
            .invoiceAmount(invoice.getInvoiceAmount())
            .markedPaidBy(markedBy)
            .paidAt(LocalDateTime.now())
            .build();
        kafkaTemplate.send("invoice.paid", event)
            .whenComplete((result, ex) -> {
                if (ex != null) log.error("Failed to publish event to invoice.paid: {}", ex.getMessage());
            });
        log.info("Invoice {} manually marked as paid by user {}", invoiceId, markedBy);
        return paid;
    }
    
    @Transactional(readOnly = true)
    public ThreeWayMatchResponse getThreeWayMatch(Long poId) {
        ThreeWayMatch match = threeWayMatchRepository.findByPoId(poId)
            .orElseThrow(() -> new RuntimeException("3-Way Match not found for PO: " + poId));
        return mapToThreeWayMatchResponse(match);
    }
    
    @Transactional
    public DisputeResponse raiseDispute(DisputeRequest request, Long raisedBy, String raisedByRole) {
        Dispute dispute = new Dispute();
        Long tenantId = TenantContext.getCurrentTenant();
        if (tenantId == null) {
            throw new IllegalStateException("Tenant context is required. Ensure request is authenticated.");
        }
        dispute.setTenantId(tenantId);
        dispute.setPoId(request.getPoId());
        dispute.setDeliveryId(request.getDeliveryId());
        dispute.setInvoiceId(request.getInvoiceId());
        dispute.setRaisedBy(raisedBy);
        dispute.setRaisedByRole(raisedByRole);
        dispute.setDisputeType(request.getDisputeType());
        dispute.setDescription(request.getDescription());
        dispute.setStatus("OPEN");
        dispute.setRaisedAt(LocalDateTime.now());
        
        Dispute savedDispute = disputeRepository.save(dispute);

        kafkaTemplate.send("dispute.raised", Map.of(
            "disputeId", savedDispute.getDisputeId(),
            "poId", request.getPoId(),
            "disputeType", request.getDisputeType(),
            "description", request.getDescription(),
            "raisedBy", raisedBy,
            "raisedByRole", raisedByRole != null ? raisedByRole : ""
        )).whenComplete((r, ex) -> {
            if (ex != null) log.error("Failed to publish dispute.raised: {}", ex.getMessage());
        });

        log.info("Dispute raised: {} for PO: {}", savedDispute.getDisputeId(), request.getPoId());
        return mapToDisputeResponse(savedDispute);
    }
    
    @Transactional
    public DisputeResponse resolveDispute(Long disputeId, ResolutionRequest request, Long resolvedBy) {
        Dispute dispute = disputeRepository.findById(disputeId)
            .orElseThrow(() -> new RuntimeException("Dispute not found"));
        
        dispute.setStatus("RESOLVED");
        dispute.setResolution(request.getResolution());
        dispute.setResolvedBy(resolvedBy);
        dispute.setResolvedAt(LocalDateTime.now());
        
        Dispute resolvedDispute = disputeRepository.save(dispute);

        // Update linked invoice status based on resolution outcome
        if (resolvedDispute.getInvoiceId() != null) {
            invoiceRepository.findById(resolvedDispute.getInvoiceId()).ifPresent(invoice -> {
                if (InvoiceStatus.DISPUTED.equals(invoice.getStatus())) {
                    String outcome = request.getOutcome() != null ? request.getOutcome().trim().toUpperCase() : "";
                    if ("APPROVE_INVOICE".equals(outcome)) {
                        InvoiceStatus.validateTransition(invoice.getStatus(), InvoiceStatus.APPROVED);
                        invoice.setStatus(InvoiceStatus.APPROVED);
                        invoice.setDiscrepancyFlag(false);
                    } else if ("REJECT_INVOICE".equals(outcome)) {
                        InvoiceStatus.validateTransition(invoice.getStatus(), InvoiceStatus.REJECTED);
                        invoice.setStatus(InvoiceStatus.REJECTED);
                    } else {
                        throw new RuntimeException("Invalid dispute outcome. Use APPROVE_INVOICE or REJECT_INVOICE");
                    }
                    invoiceRepository.save(invoice);
                    log.info("Invoice {} status updated to {} after dispute {} resolution",
                        invoice.getInvoiceId(), invoice.getStatus(), disputeId);
                }
            });
        }

        kafkaTemplate.send("dispute.resolved", Map.of(
            "disputeId", disputeId,
            "poId", resolvedDispute.getPoId() != null ? resolvedDispute.getPoId() : 0L,
            "resolution", request.getResolution() != null ? request.getResolution() : "",
            "resolvedBy", resolvedBy,
            "disputeType", resolvedDispute.getDisputeType() != null ? resolvedDispute.getDisputeType() : ""
        )).whenComplete((r, ex) -> {
            if (ex != null) log.error("Failed to publish dispute.resolved: {}", ex.getMessage());
        });

        log.info("Dispute resolved: {}", disputeId);
        return mapToDisputeResponse(resolvedDispute);
    }
    
    @Transactional(readOnly = true)
    public PagedResponse<DisputeResponse> getAllDisputes(int page, int size) {
        Page<Dispute> p = disputeRepository.findAll(
            PageRequest.of(page, size, Sort.unsorted()));
        return PagedResponse.<DisputeResponse>builder()
            .content(p.getContent().stream().map(this::mapToDisputeResponse).collect(Collectors.toList()))
            .page(p.getNumber()).size(p.getSize())
            .totalElements(p.getTotalElements()).totalPages(p.getTotalPages()).last(p.isLast()).build();
    }
    
    @Transactional(readOnly = true)
    public List<DisputeResponse> getDisputesByStatus(String status) {
        return disputeRepository.findByStatus(status).stream()
            .map(this::mapToDisputeResponse)
            .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public DisputeResponse getDisputeById(Long disputeId) {
        Dispute dispute = disputeRepository.findById(disputeId)
            .orElseThrow(() -> new RuntimeException("Dispute not found: " + disputeId));
        return mapToDisputeResponse(dispute);
    }
    
    private ThreeWayMatchResponse mapToThreeWayMatchResponse(ThreeWayMatch match) {
        return ThreeWayMatchResponse.builder()
            .matchId(match.getMatchId())
            .poId(match.getPoId())
            .deliveryId(match.getDeliveryId())
            .invoiceId(match.getInvoiceId())
            .poAmount(match.getPoAmount())
            .poQuantity(match.getPoQuantity())
            .invoiceAmount(match.getInvoiceAmount())
            .deliveryQuantity(match.getDeliveryQuantity())
            .quantityMatch(match.getQuantityMatch())
            .priceMatch(match.getPriceMatch())
            .status(match.getStatus())
            .mismatchReason(match.getMismatchReason())
            .validatedAt(match.getValidatedAt())
            .build();
    }
    
    private DisputeResponse mapToDisputeResponse(Dispute dispute) {
        return DisputeResponse.builder()
            .disputeId(dispute.getDisputeId())
            .poId(dispute.getPoId())
            .deliveryId(dispute.getDeliveryId())
            .invoiceId(dispute.getInvoiceId())
            .raisedBy(dispute.getRaisedBy())
            .raisedByRole(dispute.getRaisedByRole())
            .disputeType(dispute.getDisputeType())
            .description(dispute.getDescription())
            .status(dispute.getStatus())
            .resolution(dispute.getResolution())
            .resolvedBy(dispute.getResolvedBy())
            .raisedAt(dispute.getRaisedAt())
            .resolvedAt(dispute.getResolvedAt())
            .build();
    }
}

