package com.procurement.procurementservice.controller;

import com.procurement.procurementservice.dto.*;
import com.procurement.procurementservice.service.PurchaseOrderService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/purchase-orders")
@RequiredArgsConstructor
public class PurchaseOrderController {

    private final PurchaseOrderService poService;

    /** Extracts the authenticated userId from the SecurityContext principal.
     *  The JwtAuthenticationFilter sets principal = userId (Long) after validating the JWT. */
    private Long currentUserId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || auth.getPrincipal() == null) return 0L;
        Object principal = auth.getPrincipal();
        if (principal instanceof Long id) return id;
        try { return Long.parseLong(principal.toString()); } catch (NumberFormatException e) { return 0L; }
    }

    private String currentUserRole() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null) return "OFFICER";
        return auth.getAuthorities().stream().findFirst()
            .map(a -> a.getAuthority().replace("ROLE_", ""))
            .orElse("OFFICER");
    }

    @PostMapping
    public ResponseEntity<PurchaseOrderResponse> createPO(
            @Valid @RequestBody PurchaseOrderRequest request) {
        return ResponseEntity.ok(poService.createPurchaseOrder(request, currentUserId()));
    }

    @GetMapping
    public ResponseEntity<PagedResponse<PurchaseOrderResponse>> getAllPOs(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String statuses,
            @RequestParam(required = false) List<Long> vendorIds,
            @RequestParam(required = false, defaultValue = "id-desc") String sort) {
        return ResponseEntity.ok(poService.getAllPurchaseOrders(
            page, size, search, status, statuses, vendorIds, sort));
    }

    @GetMapping("/{poId}")
    public ResponseEntity<PurchaseOrderResponse> getPO(@PathVariable Long poId) {
        return ResponseEntity.ok(poService.getPurchaseOrder(poId));
    }

    @PostMapping("/{poId}/approve")
    public ResponseEntity<PurchaseOrderResponse> approvePO(@PathVariable Long poId) {
        // userId and role both come from the SecurityContext — set by JwtAuthenticationFilter
        // after validating the JWT. SecurityConfig already enforces MANAGER/ADMIN/DIRECTOR only.
        return ResponseEntity.ok(poService.approvePurchaseOrder(poId, currentUserId(), currentUserRole()));
    }

    @PostMapping("/{poId}/reject")
    public ResponseEntity<PurchaseOrderResponse> rejectPO(@PathVariable Long poId) {
        return ResponseEntity.ok(poService.rejectPurchaseOrder(poId, currentUserId()));
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
