package com.procurement.procurementservice.service;

import com.procurement.procurementservice.dto.*;
import com.procurement.procurementservice.entity.PurchaseOrder;
import com.procurement.procurementservice.event.POApprovedEvent;
import com.procurement.procurementservice.infrastructure.client.RFQClient;
import com.procurement.procurementservice.infrastructure.client.VendorClient;
import com.procurement.procurementservice.repository.PurchaseOrderRepository;
import com.procurement.procurementservice.repository.PurchaseOrderSpecifications;
import com.procurement.procurementservice.tenant.TenantContext;
import com.procurement.procurementservice.workflow.PurchaseOrderStatus;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
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
    private final RFQClient rfqClient;
    
    @Value("${approval.threshold.manager:10000}")
    private BigDecimal managerThreshold;
    
    @Value("${approval.threshold.director:50000}")
    private BigDecimal directorThreshold;
    
    @Transactional
    public PurchaseOrderResponse createPurchaseOrder(PurchaseOrderRequest request, Long userId) {
        if (poRepository.existsByRfqIdAndStatusNot(request.getRfqId(), PurchaseOrderStatus.REJECTED)) {
            throw new RuntimeException("A purchase order already exists for RFQ " + request.getRfqId());
        }

        Map<String, Object> rfq = rfqClient.getRFQById(request.getRfqId());
        if (rfq == null || rfq.isEmpty()) {
            throw new RuntimeException("RFQ not found: " + request.getRfqId());
        }
        Object rfqStatus = rfq.get("status");
        if (rfqStatus == null || !"Awarded".equalsIgnoreCase(rfqStatus.toString())) {
            throw new RuntimeException("Purchase order can only be created from an awarded RFQ (current status: " + rfqStatus + ")");
        }

        Map<String, Object> winningBid = rfqClient.getWinningBid(request.getRfqId());
        if (winningBid == null || winningBid.isEmpty()) {
            throw new RuntimeException("Could not verify winning bid for RFQ " + request.getRfqId());
        }
        Object winningVendorId = winningBid.get("vendorId");
        if (winningVendorId != null && !winningVendorId.toString().equals(String.valueOf(request.getVendorId()))) {
            throw new RuntimeException("Vendor does not match the awarded bid for this RFQ");
        }
        Object winningAmount = winningBid.get("bidAmount");
        if (winningAmount != null && request.getTotalAmount().compareTo(new BigDecimal(winningAmount.toString())) != 0) {
            throw new RuntimeException("PO amount must match the awarded bid amount");
        }

        PurchaseOrder po = new PurchaseOrder();
        Long tenantId = TenantContext.getCurrentTenant();
        if (tenantId == null) {
            throw new IllegalStateException("Tenant context is required. Ensure request is authenticated.");
        }
        po.setTenantId(tenantId);
        po.setRfqId(request.getRfqId());
        Object requisitionId = rfq.get("requisitionId");
        if (requisitionId != null) {
            po.setRequisitionId(Long.parseLong(requisitionId.toString()));
        }
        if (request.getBidId() != null) {
            po.setBidId(request.getBidId());
        } else if (winningBid != null && winningBid.get("bidId") != null) {
            po.setBidId(Long.parseLong(winningBid.get("bidId").toString()));
        }
        po.setVendorId(request.getVendorId());
        po.setTotalAmount(request.getTotalAmount());
        po.setStatus(PurchaseOrderStatus.DRAFT);
        po.setIssueDate(LocalDate.now());
        po.setExpectedDeliveryDate(request.getExpectedDeliveryDate());
        po.setCreatedBy(userId);
        
        // Auto-approve if below manager threshold
        if (request.getTotalAmount().compareTo(managerThreshold) < 0) {
            po.setStatus(PurchaseOrderStatus.APPROVED);
            po.setApprovedBy(userId);
            po.setApprovalDate(LocalDate.now());
            log.info("PO auto-approved (below manager threshold of {}): amount={}", managerThreshold, request.getTotalAmount());
        } else {
            po.setStatus(PurchaseOrderStatus.PENDING_APPROVAL);
        }
        
        PurchaseOrder savedPO = poRepository.save(po);
        log.info("Purchase Order created: {}", savedPO.getPoId());
        
        if ("Approved".equals(savedPO.getStatus())) {
            publishApprovedEvent(savedPO);
        } else if (PurchaseOrderStatus.PENDING_APPROVAL.equals(savedPO.getStatus())) {
            publishApprovalPendingEvent(savedPO);
        }
        
        return mapToResponse(savedPO);
    }
    
    @Transactional(readOnly = true)
    public PagedResponse<PurchaseOrderResponse> getAllPurchaseOrders(
            int page,
            int size,
            String search,
            String status,
            String statuses,
            List<Long> vendorIds,
            String sort) {
        Specification<PurchaseOrder> searchSpec = PurchaseOrderSpecifications.combine(
            search, status, statuses, vendorIds);
        Specification<PurchaseOrder> spec = searchSpec;
        if (vendorIds != null && !vendorIds.isEmpty() && searchSpec != null) {
            Specification<PurchaseOrder> vendorSpec = PurchaseOrderSpecifications.withVendorIds(vendorIds);
            Specification<PurchaseOrder> textSpec = PurchaseOrderSpecifications.withSearch(search);
            Specification<PurchaseOrder> statusSpec = Specification.where(PurchaseOrderSpecifications.withStatus(status))
                .and(PurchaseOrderSpecifications.withStatuses(statuses));
            spec = Specification.where(statusSpec)
                .and(Specification.where(textSpec).or(vendorSpec));
        }
        Page<PurchaseOrder> poPage = poRepository.findAll(
            spec, PageRequest.of(page, size, resolvePoSort(sort)));
        List<PurchaseOrder> orders = poPage.getContent();
        List<Long> resolvedVendorIds = orders.stream()
            .map(PurchaseOrder::getVendorId).filter(id -> id != null)
            .distinct().collect(Collectors.toList());
        Map<Long, String> vendorNames = vendorClient.getVendorNamesBatch(resolvedVendorIds);
        List<PurchaseOrderResponse> content = orders.stream()
            .map(po -> mapToResponse(po, vendorNames)).collect(Collectors.toList());
        return PagedResponse.<PurchaseOrderResponse>builder()
            .content(content).page(poPage.getNumber()).size(poPage.getSize())
            .totalElements(poPage.getTotalElements()).totalPages(poPage.getTotalPages())
            .last(poPage.isLast()).build();
    }

    private Sort resolvePoSort(String sort) {
        if (sort == null || sort.isBlank()) {
            return Sort.by(Sort.Direction.DESC, "poId");
        }
        return switch (sort) {
            case "amount-asc" -> Sort.by(Sort.Direction.ASC, "totalAmount");
            case "amount-desc" -> Sort.by(Sort.Direction.DESC, "totalAmount");
            case "date-asc" -> Sort.by(Sort.Direction.ASC, "issueDate");
            case "date-desc" -> Sort.by(Sort.Direction.DESC, "issueDate");
            case "id-asc" -> Sort.by(Sort.Direction.ASC, "poId");
            default -> Sort.by(Sort.Direction.DESC, "poId");
        };
    }
    
    @Transactional(readOnly = true)
    public PurchaseOrderResponse getPurchaseOrder(Long poId) {
        PurchaseOrder po = poRepository.findById(poId)
            .orElseThrow(() -> new RuntimeException("Purchase Order not found"));
        return mapToResponse(po);
    }
    
    @Transactional
    public PurchaseOrderResponse approvePurchaseOrder(Long poId, Long approverId, String approverRole) {
        PurchaseOrder po = poRepository.findById(poId)
            .orElseThrow(() -> new RuntimeException("Purchase Order not found"));
        
        if (!PurchaseOrderStatus.PENDING_APPROVAL.equals(po.getStatus())) {
            throw new RuntimeException("PO is not pending approval");
        }
        
        boolean canApprove = false;

        if ("ADMIN".equals(approverRole) || "SUPER_ADMIN".equals(approverRole)) {
            // ADMIN and SUPER_ADMIN can approve any PO regardless of amount
            canApprove = true;
        } else if (po.getTotalAmount().compareTo(managerThreshold) >= 0 &&
            po.getTotalAmount().compareTo(directorThreshold) < 0 &&
            "MANAGER".equals(approverRole)) {
            canApprove = true;
        } else if (po.getTotalAmount().compareTo(directorThreshold) >= 0 &&
                   "DIRECTOR".equals(approverRole)) {
            canApprove = true;
        }

        if (!canApprove) {
            throw new RuntimeException("Approver role '" + approverRole +
                "' does not have sufficient privileges to approve a PO of $" + po.getTotalAmount());
        }
        
        po.setStatus(PurchaseOrderStatus.APPROVED);
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

        PurchaseOrderStatus.validateTransition(po.getStatus(), PurchaseOrderStatus.REJECTED);
        po.setStatus(PurchaseOrderStatus.REJECTED);
        po.setApprovedBy(rejectorId); // reuse field to record who rejected
        PurchaseOrder rejectedPO = poRepository.save(po);
        log.info("Purchase Order rejected: {} by user: {}", poId, rejectorId);

        return mapToResponse(rejectedPO);
    }
    
    @Transactional
    public PurchaseOrderResponse updateStatus(Long poId, String status) {
        PurchaseOrder po = poRepository.findById(poId)
            .orElseThrow(() -> new RuntimeException("Purchase Order not found"));

        PurchaseOrderStatus.validateTransition(po.getStatus(), status);
        
        po.setStatus(status);
        PurchaseOrder updatedPO = poRepository.save(po);
        log.info("Purchase Order status updated: {} to {}", poId, status);
        
        return mapToResponse(updatedPO);
    }

    @Transactional
    public PurchaseOrderResponse updatePurchaseOrder(Long poId, PurchaseOrderRequest request) {
        PurchaseOrder po = poRepository.findById(poId)
            .orElseThrow(() -> new RuntimeException("Purchase Order not found"));

        boolean financialFieldChanging = request.getVendorId() != null || request.getTotalAmount() != null;
        if (financialFieldChanging && List.of("Approved", "Completed", "Delivered", "Rejected").contains(po.getStatus())) {
            throw new RuntimeException(
                "Cannot modify financial details of a " + po.getStatus() + " Purchase Order");
        }

        if (request.getVendorId() != null) po.setVendorId(request.getVendorId());
        if (request.getTotalAmount() != null) po.setTotalAmount(request.getTotalAmount());
        if (request.getExpectedDeliveryDate() != null) po.setExpectedDeliveryDate(request.getExpectedDeliveryDate());

        PurchaseOrder updatedPO = poRepository.save(po);
        log.info("Purchase Order updated: {}", poId);
        return mapToResponse(updatedPO);
    }
    
    private void publishApprovedEvent(PurchaseOrder po) {
        String vendorEmail = null;
        String vendorName = null;
        try {
            Map<String, Object> vendorData = vendorClient.getVendorById(po.getVendorId());
            if (vendorData != null) {
                vendorEmail = (String) vendorData.get("email");
                vendorName = (String) vendorData.get("companyName");
            }
        } catch (Exception e) {
            log.warn("Could not fetch vendor email for PO {}: {}", po.getPoId(), e.getMessage());
        }
        POApprovedEvent event = POApprovedEvent.builder()
            .tenantId(po.getTenantId())
            .poId(po.getPoId())
            .rfqId(po.getRfqId())
            .vendorId(po.getVendorId())
            .totalAmount(po.getTotalAmount())
            .approvedBy(po.getApprovedBy())
            .approvedAt(LocalDateTime.now())
            .vendorEmail(vendorEmail)
            .vendorName(vendorName)
            .build();
        
        kafkaTemplate.send("po.approved", event)
            .whenComplete((result, ex) -> {
                if (ex != null) log.error("Failed to publish po.approved event for PO {}: {}", po.getPoId(), ex.getMessage());
                else log.info("PO Approved event published: {}", po.getPoId());
            });
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
        kafkaTemplate.send("approval.pending", event)
            .whenComplete((result, ex) -> {
                if (ex != null) log.error("Failed to publish approval.pending event for PO {}: {}", po.getPoId(), ex.getMessage());
                else log.info("Approval Pending event published for PO: {}", po.getPoId());
            });
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
            .requisitionId(po.getRequisitionId())
            .bidId(po.getBidId())
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


