package com.procurement.procurementservice.controller;

import com.procurement.procurementservice.dto.*;
import com.procurement.procurementservice.service.PurchaseOrderService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;
@RestController
@RequestMapping("/api/purchase-orders")
@RequiredArgsConstructor
public class PurchaseOrderController {

    private final PurchaseOrderService poService;

    @PostMapping
    public ResponseEntity<PurchaseOrderResponse> createPO(
            @Valid @RequestBody PurchaseOrderRequest request,
            @RequestHeader("X-User-Id") Long userId) {
        return ResponseEntity.ok(poService.createPurchaseOrder(request, userId));
    }

    @GetMapping
    public ResponseEntity<PagedResponse<PurchaseOrderResponse>> getAllPOs(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {
        return ResponseEntity.ok(poService.getAllPurchaseOrders(page, size));
    }

    @GetMapping("/{poId}")
    public ResponseEntity<PurchaseOrderResponse> getPO(@PathVariable Long poId) {
        return ResponseEntity.ok(poService.getPurchaseOrder(poId));
    }

    @PostMapping("/{poId}/approve")
    public ResponseEntity<PurchaseOrderResponse> approvePO(
            @PathVariable Long poId,
            @RequestHeader("X-User-Id") Long approverId) {
        String approverRole = SecurityContextHolder.getContext().getAuthentication()
            .getAuthorities().stream().findFirst()
            .map(a -> a.getAuthority().replace("ROLE_", ""))
            .orElse("MANAGER");
        return ResponseEntity.ok(poService.approvePurchaseOrder(poId, approverId, approverRole));
    }

    @PostMapping("/{poId}/reject")
    public ResponseEntity<PurchaseOrderResponse> rejectPO(@PathVariable Long poId) {
        return ResponseEntity.ok(poService.rejectPurchaseOrder(poId));
    }

    @PutMapping("/{poId}/status")
    public ResponseEntity<PurchaseOrderResponse> updateStatus(
            @PathVariable Long poId,
            @RequestParam String status) {
        return ResponseEntity.ok(poService.updateStatus(poId, status));
    }

    @PutMapping("/{poId}")
    public ResponseEntity<PurchaseOrderResponse> updatePO(
            @PathVariable Long poId,
            @Valid @RequestBody PurchaseOrderRequest request) {
        return ResponseEntity.ok(poService.updatePurchaseOrder(poId, request));
    }
}
