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
    public ResponseEntity<List<PurchaseOrderResponse>> getAllPOs() {
        return ResponseEntity.ok(poService.getAllPurchaseOrders());
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
            @RequestHeader("X-User-Role") String approverRole) {
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
}
