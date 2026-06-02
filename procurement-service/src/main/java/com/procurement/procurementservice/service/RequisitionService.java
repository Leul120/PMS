package com.procurement.procurementservice.service;

import com.procurement.procurementservice.dto.*;
import com.procurement.procurementservice.entity.ApprovalHistory;
import com.procurement.procurementservice.entity.PurchaseRequisition;
import com.procurement.procurementservice.entity.RequisitionItem;
import com.procurement.procurementservice.repository.ApprovalHistoryRepository;
import com.procurement.procurementservice.repository.PurchaseRequisitionRepository;
import com.procurement.procurementservice.repository.RequisitionSpecifications;
import com.procurement.procurementservice.tenant.TenantContext;
import com.procurement.procurementservice.workflow.RequisitionStatus;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
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
        Long tenantId = TenantContext.requireCurrentTenant();
        PurchaseRequisition requisition = new PurchaseRequisition();
        requisition.setTenantId(tenantId);
        requisition.setRequisitionNumber("REQ-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase());
        requisition.setRequesterId(requesterId);
        requisition.setDepartment(request.getDepartment());
        requisition.setJustification(request.getJustification());
        requisition.setEstimatedBudget(request.getEstimatedBudget());
        requisition.setStatus(RequisitionStatus.DRAFT);
        requisition.setCurrentApprovalLevel(0);
        requisition.setCreatedAt(LocalDateTime.now());
        requisition.setUpdatedAt(LocalDateTime.now());
        
        PurchaseRequisition savedRequisition = requisitionRepository.save(requisition);
        
        // Save items
        List<RequisitionItem> items = request.getItems().stream()
            .map(itemReq -> {
                RequisitionItem item = new RequisitionItem();
                item.setTenantId(tenantId);
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
    
    @Transactional(readOnly = true)
    public PagedResponse<RequisitionResponse> getAllRequisitions(
            int page,
            int size,
            String search,
            String status,
            String statuses,
            String sort) {
        Specification<PurchaseRequisition> spec = RequisitionSpecifications.combine(search, status, statuses);
        Page<PurchaseRequisition> p = requisitionRepository.findAll(
            spec, PageRequest.of(page, size, resolveRequisitionSort(sort)));
        return PagedResponse.<RequisitionResponse>builder()
            .content(p.getContent().stream().map(this::mapToRequisitionResponse).collect(Collectors.toList()))
            .page(p.getNumber()).size(p.getSize())
            .totalElements(p.getTotalElements()).totalPages(p.getTotalPages()).last(p.isLast()).build();
    }

    private Sort resolveRequisitionSort(String sort) {
        if (sort == null || sort.isBlank()) {
            return Sort.by(Sort.Direction.DESC, "createdAt");
        }
        return switch (sort) {
            case "date-asc" -> Sort.by(Sort.Direction.ASC, "createdAt");
            case "budget-asc" -> Sort.by(Sort.Direction.ASC, "estimatedBudget");
            case "budget-desc" -> Sort.by(Sort.Direction.DESC, "estimatedBudget");
            case "number-asc" -> Sort.by(Sort.Direction.ASC, "requisitionNumber");
            default -> Sort.by(Sort.Direction.DESC, "createdAt");
        };
    }

    @Transactional(readOnly = true)
    public RequisitionResponse getRequisition(Long requisitionId) {
        PurchaseRequisition requisition = requisitionRepository.findById(requisitionId)
            .orElseThrow(() -> new RuntimeException("Requisition not found"));
        return mapToRequisitionResponse(requisition);
    }

    @Transactional(readOnly = true)
    public List<RequisitionResponse> getRequisitionsByStatus(String status) {
        return requisitionRepository.findByStatus(status).stream()
            .map(this::mapToRequisitionResponse)
            .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<RequisitionResponse> getMyRequisitions(Long requesterId) {
        return requisitionRepository.findByRequesterId(requesterId).stream()
            .map(this::mapToRequisitionResponse)
            .collect(Collectors.toList());
    }
    
    @Transactional
    public RequisitionResponse submitRequisition(Long requisitionId, Long requesterId) {
        PurchaseRequisition requisition = requisitionRepository.findById(requisitionId)
            .orElseThrow(() -> new RuntimeException("Requisition not found"));

        if (!requisition.getRequesterId().equals(requesterId)) {
            throw new RuntimeException("Only the requester can submit this requisition");
        }
        RequisitionStatus.validateTransition(requisition.getStatus(), RequisitionStatus.PENDING_APPROVAL);

        requisition.setStatus(RequisitionStatus.PENDING_APPROVAL);
        requisition.setCurrentApprovalLevel(1);
        requisition.setUpdatedAt(LocalDateTime.now());
        PurchaseRequisition updated = requisitionRepository.save(requisition);
        log.info("Requisition submitted for approval: {}", requisition.getRequisitionNumber());
        return mapToRequisitionResponse(updated);
    }
    
    @Transactional
    public RequisitionResponse approveRequisition(Long requisitionId, ApprovalRequest request, Long approverId, String approverRole) {
        PurchaseRequisition requisition = requisitionRepository.findById(requisitionId)
            .orElseThrow(() -> new RuntimeException("Requisition not found"));

        if (!RequisitionStatus.PENDING_APPROVAL.equals(requisition.getStatus())) {
            throw new RuntimeException("Requisition is not pending approval");
        }

        int currentLevel = requisition.getCurrentApprovalLevel();
        String requiredRole = getRequiredRoleForLevel(currentLevel);
        if (!requiredRole.equals(approverRole) && !"SUPER_ADMIN".equals(approverRole)) {
            throw new RuntimeException(
                "Approval level " + currentLevel + " requires role " + requiredRole + " — your role is " + approverRole);
        }

        if (approvalHistoryRepository.existsByRequisitionRequisitionIdAndApproverIdAndApprovalLevel(
                requisitionId, approverId, currentLevel)) {
            throw new RuntimeException("You have already submitted a decision for this approval level");
        }

        int requiredLevel = getRequiredApprovalLevel(requisition.getEstimatedBudget());

        ApprovalHistory history = new ApprovalHistory();
        history.setTenantId(TenantContext.requireCurrentTenant());
        history.setRequisition(requisition);
        history.setApproverId(approverId);
        history.setApproverRole(approverRole);
        history.setApprovalLevel(currentLevel);
        history.setDecision(request.getDecision());
        history.setComments(request.getComments());
        history.setApprovedAt(LocalDateTime.now());
        approvalHistoryRepository.save(history);

        if ("REJECTED".equals(request.getDecision())) {
            requisition.setStatus(RequisitionStatus.REJECTED);
        } else if (currentLevel >= requiredLevel) {
            requisition.setStatus(RequisitionStatus.APPROVED);
        } else {
            requisition.setCurrentApprovalLevel(currentLevel + 1);
        }

        requisition.setUpdatedAt(LocalDateTime.now());
        PurchaseRequisition updatedRequisition = requisitionRepository.save(requisition);

        log.info("Requisition {} {} at level {} by {} ({})", requisitionId, request.getDecision(), currentLevel, approverId, approverRole);
        return mapToRequisitionResponse(updatedRequisition);
    }
    
    private int getRequiredApprovalLevel(BigDecimal amount) {
        if (amount.compareTo(new BigDecimal("50000")) > 0) return 3;
        if (amount.compareTo(new BigDecimal("10000")) > 0) return 2;
        return 1;
    }

    private String getRequiredRoleForLevel(int level) {
        return switch (level) {
            case 1 -> "MANAGER";
            case 2 -> "DIRECTOR";
            default -> "ADMIN";
        };
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


