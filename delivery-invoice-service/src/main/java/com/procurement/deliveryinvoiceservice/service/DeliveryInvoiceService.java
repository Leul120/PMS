package com.procurement.deliveryinvoiceservice.service;

import com.procurement.deliveryinvoiceservice.dto.*;
import com.procurement.deliveryinvoiceservice.entity.Delivery;
import com.procurement.deliveryinvoiceservice.entity.Dispute;
import com.procurement.deliveryinvoiceservice.entity.Invoice;
import com.procurement.deliveryinvoiceservice.entity.ThreeWayMatch;
import com.procurement.deliveryinvoiceservice.event.DeliveryCompletedEvent;
import com.procurement.deliveryinvoiceservice.event.InvoiceDiscrepancyEvent;
import com.procurement.deliveryinvoiceservice.repository.DeliveryRepository;
import com.procurement.deliveryinvoiceservice.repository.DisputeRepository;
import com.procurement.deliveryinvoiceservice.repository.InvoiceRepository;
import com.procurement.deliveryinvoiceservice.repository.ThreeWayMatchRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;
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
    
    @Transactional
    public Delivery createDelivery(Long poId, Long vendorId, LocalDate expectedDate, 
                                   LocalDate actualDate, Integer quantityDelivered, 
                                   String issueNotes, String qualityRemarks) {
        Delivery delivery = new Delivery();
        delivery.setPoId(poId);
        delivery.setExpectedDate(expectedDate);
        delivery.setActualDate(actualDate);
        delivery.setQuantityDelivered(quantityDelivered);
        delivery.setDeliveryStatus("Delivered");
        delivery.setIssueNotes(issueNotes);
        delivery.setQualityRemarks(qualityRemarks);
        
        // Calculate delay days
        int delayDays = 0;
        if (actualDate != null && expectedDate != null && actualDate.isAfter(expectedDate)) {
            delayDays = (int) ChronoUnit.DAYS.between(expectedDate, actualDate);
        }
        delivery.setDelayDays(delayDays);
        
        Delivery savedDelivery = deliveryRepository.save(delivery);
        
        // Publish event
        DeliveryCompletedEvent event = DeliveryCompletedEvent.builder()
            .deliveryId(savedDelivery.getDeliveryId())
            .poId(poId)
            .vendorId(vendorId)
            .delayDays(delayDays)
            .quantityDelivered(quantityDelivered)
            .qualityRemarks(qualityRemarks)
            .completedAt(LocalDateTime.now())
            .build();
        
        kafkaTemplate.send("delivery.completed", event);
        log.info("Delivery completed: {} for PO: {}", savedDelivery.getDeliveryId(), poId);
        
        return savedDelivery;
    }
    
    public List<Delivery> getDeliveriesByPO(Long poId) {
        return deliveryRepository.findByPoId(poId);
    }
    
    public List<Delivery> getAllDeliveries() {
        return deliveryRepository.findAll();
    }
    
    @Transactional
    public Invoice submitInvoice(Long poId, BigDecimal invoiceAmount, Long vendorId) {
        Invoice invoice = new Invoice();
        invoice.setPoId(poId);
        invoice.setInvoiceAmount(invoiceAmount);
        invoice.setStatus("Pending");
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
            invoice.setStatus("Disputed");
            invoice.setDiscrepancyReason(discrepancyReason);
            
            Invoice disputedInvoice = invoiceRepository.save(invoice);
            
            InvoiceDiscrepancyEvent event = InvoiceDiscrepancyEvent.builder()
                .invoiceId(invoiceId)
                .poId(invoice.getPoId())
                .invoiceAmount(invoice.getInvoiceAmount())
                .expectedAmount(expectedAmount)
                .discrepancyReason(discrepancyReason)
                .detectedAt(LocalDateTime.now())
                .build();
            
            kafkaTemplate.send("invoice.discrepancy", event);
            log.info("Invoice discrepancy detected: {}", invoiceId);
            
            return disputedInvoice;
        } else {
            invoice.setStatus("Approved");
            invoice.setDiscrepancyFlag(false);
            log.info("Invoice validated successfully: {}", invoiceId);
            return invoiceRepository.save(invoice);
        }
    }
    
    @Transactional
    public Invoice disputeInvoice(Long invoiceId, String reason) {
        Invoice invoice = invoiceRepository.findById(invoiceId)
            .orElseThrow(() -> new RuntimeException("Invoice not found"));
        
        invoice.setStatus("Disputed");
        invoice.setDiscrepancyFlag(true);
        invoice.setDiscrepancyReason(reason);
        
        Invoice disputedInvoice = invoiceRepository.save(invoice);
        
        InvoiceDiscrepancyEvent event = InvoiceDiscrepancyEvent.builder()
            .invoiceId(invoiceId)
            .poId(invoice.getPoId())
            .invoiceAmount(invoice.getInvoiceAmount())
            .discrepancyReason(reason)
            .detectedAt(LocalDateTime.now())
            .build();
        
        kafkaTemplate.send("invoice.discrepancy", event);
        log.info("Invoice disputed: {} - Reason: {}", invoiceId, reason);
        
        return disputedInvoice;
    }
    
    public List<Invoice> getInvoicesByPO(Long poId) {
        return invoiceRepository.findByPoId(poId);
    }
    
    public List<Invoice> getAllInvoices() {
        return invoiceRepository.findAll();
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
        
        log.info("3-Way Match performed for PO {}: {}", poId, status);
        return mapToThreeWayMatchResponse(savedMatch);
    }
    
    public ThreeWayMatchResponse getThreeWayMatch(Long poId) {
        ThreeWayMatch match = threeWayMatchRepository.findByPoId(poId)
            .orElseThrow(() -> new RuntimeException("3-Way Match not found for PO: " + poId));
        return mapToThreeWayMatchResponse(match);
    }
    
    @Transactional
    public DisputeResponse raiseDispute(DisputeRequest request, Long raisedBy, String raisedByRole) {
        Dispute dispute = new Dispute();
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
        
        log.info("Dispute resolved: {}", disputeId);
        return mapToDisputeResponse(resolvedDispute);
    }
    
    public List<DisputeResponse> getAllDisputes() {
        return disputeRepository.findAll().stream()
            .map(this::mapToDisputeResponse)
            .collect(Collectors.toList());
    }
    
    public List<DisputeResponse> getDisputesByStatus(String status) {
        return disputeRepository.findByStatus(status).stream()
            .map(this::mapToDisputeResponse)
            .collect(Collectors.toList());
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
