package com.procurement.procurementservice.service;

import com.procurement.procurementservice.dto.*;
import com.procurement.procurementservice.entity.ApprovalHistory;
import com.procurement.procurementservice.entity.PurchaseRequisition;
import com.procurement.procurementservice.entity.RequisitionItem;
import com.procurement.procurementservice.repository.ApprovalHistoryRepository;
import com.procurement.procurementservice.repository.PurchaseRequisitionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class RequisitionService {
    
    private final PurchaseRequisitionRepository requisitionRepository;
    private final ApprovalHistoryRepository approvalHistoryRepository;
    
    @Transactional
    public RequisitionResponse createRequisition(RequisitionRequest request, Long requesterId) {
        PurchaseRequisition requisition = new PurchaseRequisition();
        requisition.setRequisitionNumber("REQ-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase());
        requisition.setRequesterId(requesterId);
        requisition.setDepartment(request.getDepartment());
        requisition.setJustification(request.getJustification());
        requisition.setEstimatedBudget(request.getEstimatedBudget());
        requisition.setStatus("PENDING_APPROVAL");
        requisition.setCurrentApprovalLevel(1);
        requisition.setCreatedAt(LocalDateTime.now());
        requisition.setUpdatedAt(LocalDateTime.now());
        
        PurchaseRequisition savedRequisition = requisitionRepository.save(requisition);
        
        // Save items
        List<RequisitionItem> items = request.getItems().stream()
            .map(itemReq -> {
                RequisitionItem item = new RequisitionItem();
                item.setRequisition(savedRequisition);
                item.setItemName(itemReq.getItemName());
                item.setDescription(itemReq.getDescription());
                item.setQuantity(itemReq.getQuantity());
                item.setUnit(itemReq.getUnit());
                item.setEstimatedUnitPrice(itemReq.getEstimatedUnitPrice());
                item.setCategory(itemReq.getCategory());
                return item;
            })
            .collect(Collectors.toList());
        
        savedRequisition.setItems(items);
        requisitionRepository.save(savedRequisition);
        
        log.info("Requisition created: {}", savedRequisition.getRequisitionNumber());
        return mapToRequisitionResponse(savedRequisition);
    }
    
    public PagedResponse<RequisitionResponse> getAllRequisitions(int page, int size) {
        Page<PurchaseRequisition> p = requisitionRepository.findAll(
            PageRequest.of(page, size, Sort.unsorted()));
        return PagedResponse.<RequisitionResponse>builder()
            .content(p.getContent().stream().map(this::mapToRequisitionResponse).collect(Collectors.toList()))
            .page(p.getNumber()).size(p.getSize())
            .totalElements(p.getTotalElements()).totalPages(p.getTotalPages()).last(p.isLast()).build();
    }
    
    public RequisitionResponse getRequisition(Long requisitionId) {
        PurchaseRequisition requisition = requisitionRepository.findById(requisitionId)
            .orElseThrow(() -> new RuntimeException("Requisition not found"));
        return mapToRequisitionResponse(requisition);
    }
    
    public List<RequisitionResponse> getRequisitionsByStatus(String status) {
        return requisitionRepository.findByStatus(status).stream()
            .map(this::mapToRequisitionResponse)
            .collect(Collectors.toList());
    }
    
    public List<RequisitionResponse> getMyRequisitions(Long requesterId) {
        return requisitionRepository.findByRequesterId(requesterId).stream()
            .map(this::mapToRequisitionResponse)
            .collect(Collectors.toList());
    }
    
    @Transactional
    public RequisitionResponse approveRequisition(Long requisitionId, ApprovalRequest request, Long approverId, String approverRole) {
        PurchaseRequisition requisition = requisitionRepository.findById(requisitionId)
            .orElseThrow(() -> new RuntimeException("Requisition not found"));
        
        // Validate approval level based on amount thresholds
        BigDecimal totalAmount = requisition.getEstimatedBudget();
        int requiredLevel = getRequiredApprovalLevel(totalAmount);
        
        // Record approval history
        ApprovalHistory history = new ApprovalHistory();
        history.setRequisition(requisition);
        history.setApproverId(approverId);
        history.setApproverRole(approverRole);
        history.setApprovalLevel(requisition.getCurrentApprovalLevel());
        history.setDecision(request.getDecision());
        history.setComments(request.getComments());
        history.setApprovedAt(LocalDateTime.now());
        approvalHistoryRepository.save(history);
        
        if ("REJECTED".equals(request.getDecision())) {
            requisition.setStatus("REJECTED");
        } else if (requisition.getCurrentApprovalLevel() >= requiredLevel) {
            requisition.setStatus("APPROVED");
        } else {
            requisition.setCurrentApprovalLevel(requisition.getCurrentApprovalLevel() + 1);
        }
        
        requisition.setUpdatedAt(LocalDateTime.now());
        PurchaseRequisition updatedRequisition = requisitionRepository.save(requisition);
        
        log.info("Requisition {} {} at level {}", requisitionId, request.getDecision(), history.getApprovalLevel());
        return mapToRequisitionResponse(updatedRequisition);
    }
    
    // Approval thresholds: Level 1: < 10k, Level 2: 10k-50k, Level 3: > 50k
    private int getRequiredApprovalLevel(BigDecimal amount) {
        if (amount.compareTo(new BigDecimal("50000")) > 0) {
            return 3; // Director approval required
        } else if (amount.compareTo(new BigDecimal("10000")) > 0) {
            return 2; // Manager approval required
        }
        return 1; // Department head approval only
    }
    
    private RequisitionResponse mapToRequisitionResponse(PurchaseRequisition requisition) {
        return RequisitionResponse.builder()
            .requisitionId(requisition.getRequisitionId())
            .requisitionNumber(requisition.getRequisitionNumber())
            .requesterId(requisition.getRequesterId())
            .department(requisition.getDepartment())
            .justification(requisition.getJustification())
            .estimatedBudget(requisition.getEstimatedBudget())
            .status(requisition.getStatus())
            .currentApprovalLevel(requisition.getCurrentApprovalLevel())
            .createdAt(requisition.getCreatedAt())
            .updatedAt(requisition.getUpdatedAt())
            .items(requisition.getItems() != null ? requisition.getItems().stream()
                .map(item -> RequisitionItemResponse.builder()
                    .itemId(item.getItemId())
                    .itemName(item.getItemName())
                    .description(item.getDescription())
                    .quantity(item.getQuantity())
                    .unit(item.getUnit())
                    .estimatedUnitPrice(item.getEstimatedUnitPrice())
                    .category(item.getCategory())
                    .build())
                .collect(Collectors.toList()) : null)
            .approvalHistory(requisition.getApprovalHistory() != null ? requisition.getApprovalHistory().stream()
                .map(hist -> ApprovalHistoryResponse.builder()
                    .approvalId(hist.getApprovalId())
                    .approverId(hist.getApproverId())
                    .approverRole(hist.getApproverRole())
                    .approvalLevel(hist.getApprovalLevel())
                    .decision(hist.getDecision())
                    .comments(hist.getComments())
                    .approvedAt(hist.getApprovedAt())
                    .build())
                .collect(Collectors.toList()) : null)
            .build();
    }
}


