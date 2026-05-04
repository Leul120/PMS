package com.procurement.procurementservice.service;

import com.procurement.procurementservice.dto.*;
import com.procurement.procurementservice.entity.PurchaseOrder;
import com.procurement.procurementservice.event.POApprovedEvent;
import com.procurement.procurementservice.repository.PurchaseOrderRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class PurchaseOrderService {
    
    private final PurchaseOrderRepository poRepository;
    private final KafkaTemplate<String, Object> kafkaTemplate;
    
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
        } else {
            po.setStatus("Pending Approval");
        }
        
        PurchaseOrder savedPO = poRepository.save(po);
        log.info("Purchase Order created: {}", savedPO.getPoId());
        
        if ("Approved".equals(savedPO.getStatus())) {
            publishApprovedEvent(savedPO);
        }
        
        return mapToResponse(savedPO);
    }
    
    public List<PurchaseOrderResponse> getAllPurchaseOrders() {
        return poRepository.findAll().stream()
            .map(this::mapToResponse)
            .collect(Collectors.toList());
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
        
        if (po.getTotalAmount().compareTo(managerThreshold) >= 0 && 
            po.getTotalAmount().compareTo(directorThreshold) < 0 && 
            "MANAGER".equals(approverRole)) {
            canApprove = true;
        } else if (po.getTotalAmount().compareTo(directorThreshold) >= 0 && 
                   "ADMIN".equals(approverRole)) {
            canApprove = true;
        }
        
        if (!canApprove) {
            throw new RuntimeException("Approver does not have sufficient privileges");
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
    public PurchaseOrderResponse rejectPurchaseOrder(Long poId) {
        PurchaseOrder po = poRepository.findById(poId)
            .orElseThrow(() -> new RuntimeException("Purchase Order not found"));
        
        po.setStatus("Rejected");
        PurchaseOrder rejectedPO = poRepository.save(po);
        log.info("Purchase Order rejected: {}", poId);
        
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
    
    private PurchaseOrderResponse mapToResponse(PurchaseOrder po) {
        return PurchaseOrderResponse.builder()
            .poId(po.getPoId())
            .rfqId(po.getRfqId())
            .vendorId(po.getVendorId())
            .totalAmount(po.getTotalAmount())
            .managerId(po.getManagerId())
            .status(po.getStatus())
            .issueDate(po.getIssueDate())
            .expectedDeliveryDate(po.getExpectedDeliveryDate())
            .approvedBy(po.getApprovedBy())
            .approvalDate(po.getApprovalDate())
            .build();
    }
}
