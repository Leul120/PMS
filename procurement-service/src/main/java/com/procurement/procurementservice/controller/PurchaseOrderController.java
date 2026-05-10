package com.procurement.procurementservice.controller;

import com.procurement.procurementservice.dto.*;
import com.procurement.procurementservice.service.PurchaseOrderService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
@RestController
@RequestMapping("/api/purchase-orders")
@RequiredArgsConstructor
public class PurchaseOrderController {
    
    private final PurchaseOrderService poService;
    
    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'OFFICER')")
    public ResponseEntity<PurchaseOrderResponse> createPO(
            @Valid @RequestBody PurchaseOrderRequest request,
            @RequestHeader("X-User-Id") Long userId) {
        return ResponseEntity.ok(poService.createPurchaseOrder(request, userId));
    }
    
    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'OFFICER', 'MANAGER', 'AUDITOR', 'VENDOR')")
    public ResponseEntity<PagedResponse<PurchaseOrderResponse>> getAllPOs(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {
        return ResponseEntity.ok(poService.getAllPurchaseOrders(page, size));
    }
    
    @GetMapping("/{poId}")
    @PreAuthorize("hasAnyRole('ADMIN', 'OFFICER', 'MANAGER', 'AUDITOR', 'VENDOR')")
    public ResponseEntity<PurchaseOrderResponse> getPO(@PathVariable Long poId) {
        return ResponseEntity.ok(poService.getPurchaseOrder(poId));
    }
    
    @PostMapping("/{poId}/approve")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<PurchaseOrderResponse> approvePO(
            @PathVariable Long poId,
            @RequestHeader("X-User-Id") Long approverId,
            @RequestHeader(value = "X-User-Role", required = false, defaultValue = "MANAGER") String approverRole) {
        return ResponseEntity.ok(poService.approvePurchaseOrder(poId, approverId, approverRole));
    }
    
    @PostMapping("/{poId}/reject")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<PurchaseOrderResponse> rejectPO(@PathVariable Long poId) {
        return ResponseEntity.ok(poService.rejectPurchaseOrder(poId));
    }
    
    @PutMapping("/{poId}/status")
    @PreAuthorize("hasAnyRole('ADMIN', 'OFFICER', 'MANAGER')")
    public ResponseEntity<PurchaseOrderResponse> updateStatus(
            @PathVariable Long poId,
            @RequestParam String status) {
        return ResponseEntity.ok(poService.updateStatus(poId, status));
    }

    @PutMapping("/{poId}")
    @PreAuthorize("hasAnyRole('ADMIN', 'OFFICER')")
    public ResponseEntity<PurchaseOrderResponse> updatePO(
            @PathVariable Long poId,
            @Valid @RequestBody PurchaseOrderRequest request) {
        return ResponseEntity.ok(poService.updatePurchaseOrder(poId, request));
    }
}
