package com.procurement.procurementservice.service;

import com.procurement.procurementservice.dto.*;
import com.procurement.procurementservice.entity.PurchaseOrder;
import com.procurement.procurementservice.event.POApprovedEvent;
import com.procurement.procurementservice.infrastructure.client.VendorClient;
import com.procurement.procurementservice.repository.PurchaseOrderRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class PurchaseOrderService {
    
    private final PurchaseOrderRepository poRepository;
    private final KafkaTemplate<String, Object> kafkaTemplate;
    private final VendorClient vendorClient;
    
    @Value("${approval.threshold.manager:10000}")
    private BigDecimal managerThreshold;
    
    @Value("${approval.threshold.director:50000}")
    private BigDecimal directorThreshold;
    
    @Transactional
    public PurchaseOrderResponse createPurchaseOrder(PurchaseOrderRequest request, Long userId) {
        PurchaseOrder po = new PurchaseOrder();
        po.setRfqId(request.getRfqId());
        po.setVendorId(request.getVendorId());
        po.setTotalAmount(request.getTotalAmount());
        po.setStatus("Draft");
        po.setIssueDate(LocalDate.now());
        po.setExpectedDeliveryDate(request.getExpectedDeliveryDate());
        po.setCreatedBy(userId);
        
        // Auto-approve if below manager threshold
        if (request.getTotalAmount().compareTo(managerThreshold) < 0) {
            po.setStatus("Approved");
            po.setApprovedBy(userId);
            po.setApprovalDate(LocalDate.now());
            log.info("PO auto-approved (below manager threshold of {}): amount={}", managerThreshold, request.getTotalAmount());
        } else {
            po.setStatus("Pending Approval");
        }
        
        PurchaseOrder savedPO = poRepository.save(po);
        log.info("Purchase Order created: {}", savedPO.getPoId());
        
        if ("Approved".equals(savedPO.getStatus())) {
            publishApprovedEvent(savedPO);
        } else if ("Pending Approval".equals(savedPO.getStatus())) {
            publishApprovalPendingEvent(savedPO);
        }
        
        return mapToResponse(savedPO);
    }
    
    public PagedResponse<PurchaseOrderResponse> getAllPurchaseOrders(int page, int size) {
        Page<PurchaseOrder> poPage = poRepository.findAll(
            PageRequest.of(page, size, Sort.unsorted()));
        List<PurchaseOrder> orders = poPage.getContent();
        List<Long> vendorIds = orders.stream()
            .map(PurchaseOrder::getVendorId).filter(id -> id != null)
            .distinct().collect(Collectors.toList());
        Map<Long, String> vendorNames = vendorClient.getVendorNamesBatch(vendorIds);
        List<PurchaseOrderResponse> content = orders.stream()
            .map(po -> mapToResponse(po, vendorNames)).collect(Collectors.toList());
        return PagedResponse.<PurchaseOrderResponse>builder()
            .content(content).page(poPage.getNumber()).size(poPage.getSize())
            .totalElements(poPage.getTotalElements()).totalPages(poPage.getTotalPages())
            .last(poPage.isLast()).build();
    }
    
    public PurchaseOrderResponse getPurchaseOrder(Long poId) {
        PurchaseOrder po = poRepository.findById(poId)
            .orElseThrow(() -> new RuntimeException("Purchase Order not found"));
        return mapToResponse(po);
    }
    
    @Transactional
    public PurchaseOrderResponse approvePurchaseOrder(Long poId, Long approverId, String approverRole) {
        PurchaseOrder po = poRepository.findById(poId)
            .orElseThrow(() -> new RuntimeException("Purchase Order not found"));
        
        if (!"Pending Approval".equals(po.getStatus())) {
            throw new RuntimeException("PO is not pending approval");
        }
        
        boolean canApprove = false;

        if ("ADMIN".equals(approverRole)) {
            // ADMIN can approve any PO regardless of amount
            canApprove = true;
        } else if (po.getTotalAmount().compareTo(managerThreshold) >= 0 &&
            po.getTotalAmount().compareTo(directorThreshold) < 0 &&
            ("MANAGER".equals(approverRole))) {
            canApprove = true;
        } else if (po.getTotalAmount().compareTo(directorThreshold) >= 0 &&
                   ("ADMIN".equals(approverRole) || "DIRECTOR".equals(approverRole))) {
            canApprove = true;
        }

        if (!canApprove) {
            throw new RuntimeException("Approver role '" + approverRole +
                "' does not have sufficient privileges to approve a PO of $" + po.getTotalAmount());
        }
        
        po.setStatus("Approved");
        po.setApprovedBy(approverId);
        po.setApprovalDate(LocalDate.now());
        
        PurchaseOrder approvedPO = poRepository.save(po);
        log.info("Purchase Order approved: {} by {}", poId, approverId);
        
        publishApprovedEvent(approvedPO);
        
        return mapToResponse(approvedPO);
    }
    
    @Transactional
    public PurchaseOrderResponse rejectPurchaseOrder(Long poId, Long rejectorId) {
        PurchaseOrder po = poRepository.findById(poId)
            .orElseThrow(() -> new RuntimeException("Purchase Order not found"));

        po.setStatus("Rejected");
        po.setApprovedBy(rejectorId); // reuse field to record who rejected
        PurchaseOrder rejectedPO = poRepository.save(po);
        log.info("Purchase Order rejected: {} by user: {}", poId, rejectorId);

        return mapToResponse(rejectedPO);
    }
    
    @Transactional
    public PurchaseOrderResponse updateStatus(Long poId, String status) {
        PurchaseOrder po = poRepository.findById(poId)
            .orElseThrow(() -> new RuntimeException("Purchase Order not found"));
        
        po.setStatus(status);
        PurchaseOrder updatedPO = poRepository.save(po);
        log.info("Purchase Order status updated: {} to {}", poId, status);
        
        return mapToResponse(updatedPO);
    }

    @Transactional
    public PurchaseOrderResponse updatePurchaseOrder(Long poId, PurchaseOrderRequest request) {
        PurchaseOrder po = poRepository.findById(poId)
            .orElseThrow(() -> new RuntimeException("Purchase Order not found"));

        if (request.getVendorId() != null) po.setVendorId(request.getVendorId());
        if (request.getTotalAmount() != null) po.setTotalAmount(request.getTotalAmount());
        if (request.getExpectedDeliveryDate() != null) po.setExpectedDeliveryDate(request.getExpectedDeliveryDate());

        PurchaseOrder updatedPO = poRepository.save(po);
        log.info("Purchase Order updated: {}", poId);
        return mapToResponse(updatedPO);
    }
    
    private void publishApprovedEvent(PurchaseOrder po) {
        POApprovedEvent event = POApprovedEvent.builder()
            .poId(po.getPoId())
            .rfqId(po.getRfqId())
            .vendorId(po.getVendorId())
            .totalAmount(po.getTotalAmount())
            .approvedBy(po.getApprovedBy())
            .approvedAt(LocalDateTime.now())
            .build();
        
        kafkaTemplate.send("po.approved", event);
        log.info("PO Approved event published: {}", po.getPoId());
    }

    private void publishApprovalPendingEvent(PurchaseOrder po) {
        Map<String, Object> event = Map.of(
            "poId", po.getPoId(),
            "rfqId", po.getRfqId() != null ? po.getRfqId() : 0L,
            "vendorId", po.getVendorId() != null ? po.getVendorId() : 0L,
            "totalAmount", po.getTotalAmount(),
            "createdBy", po.getCreatedBy() != null ? po.getCreatedBy() : 0L,
            "createdAt", LocalDateTime.now().toString()
        );
        kafkaTemplate.send("approval.pending", event);
        log.info("Approval Pending event published for PO: {}", po.getPoId());
    }
    
    private PurchaseOrderResponse mapToResponse(PurchaseOrder po) {
        String vendorName = vendorClient.getVendorName(po.getVendorId());
        return buildResponse(po, vendorName);
    }

    private PurchaseOrderResponse mapToResponse(PurchaseOrder po, Map<Long, String> vendorNames) {
        String vendorName = vendorNames.getOrDefault(po.getVendorId(), "Vendor #" + po.getVendorId());
        return buildResponse(po, vendorName);
    }

    private PurchaseOrderResponse buildResponse(PurchaseOrder po, String vendorName) {
        String poNumber = "PO-" + String.format("%06d", po.getPoId());
        return PurchaseOrderResponse.builder()
            .poId(po.getPoId())
            .id(po.getPoId())
            .poNumber(poNumber)
            .rfqId(po.getRfqId())
            .vendorId(po.getVendorId())
            .vendorName(vendorName)
            .totalAmount(po.getTotalAmount())
            .managerId(po.getManagerId())
            .status(po.getStatus())
            .issueDate(po.getIssueDate())
            .createdAt(po.getIssueDate())
            .expectedDeliveryDate(po.getExpectedDeliveryDate())
            .deliveryDate(po.getExpectedDeliveryDate())
            .approvedBy(po.getApprovedBy())
            .approvalDate(po.getApprovalDate())
            .build();
    }
}


