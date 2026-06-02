package com.procurement.deliveryinvoiceservice.controller;

import com.procurement.deliveryinvoiceservice.dto.*;
import com.procurement.deliveryinvoiceservice.entity.Delivery;
import com.procurement.deliveryinvoiceservice.entity.Invoice;
import com.procurement.deliveryinvoiceservice.infrastructure.client.VendorClient;
import com.procurement.deliveryinvoiceservice.service.DeliveryInvoiceService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class DeliveryInvoiceController {

    private final DeliveryInvoiceService service;
    private final VendorClient vendorClient;

    /** Reads the authenticated userId from the SecurityContext principal.
     *  Set by JwtAuthenticationFilter after validating the JWT — never from a header. */
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

    // ── Deliveries ──────────────────────────────────────────────────────────

    @PostMapping("/deliveries")
    public ResponseEntity<Delivery> createDelivery(@Valid @RequestBody DeliveryRequest request) {
        return ResponseEntity.ok(service.createDelivery(request));
    }

    @GetMapping("/deliveries/po/{poId}")
    public ResponseEntity<List<Delivery>> getDeliveriesByPO(@PathVariable Long poId) {
        return ResponseEntity.ok(service.getDeliveriesByPO(poId));
    }

    @PutMapping("/deliveries/{deliveryId}/status")
    public ResponseEntity<Delivery> updateDeliveryStatus(
            @PathVariable Long deliveryId,
            @RequestParam String status) {
        return ResponseEntity.ok(service.updateDeliveryStatus(deliveryId, status));
    }

    @GetMapping("/deliveries")
    public ResponseEntity<PagedResponse<Delivery>> getAllDeliveries(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String statuses,
            @RequestParam(required = false, defaultValue = "id-desc") String sort) {
        return ResponseEntity.ok(service.getAllDeliveries(page, size, search, status, statuses, sort));
    }

    // ── Invoices ─────────────────────────────────────────────────────────────

    @PostMapping("/invoices")
    public ResponseEntity<Invoice> submitInvoice(@Valid @RequestBody InvoiceRequest request) {
        Long vendorId = request.getVendorId();
        // For vendor roles, always derive vendorId from the authenticated user's profile
        if (isVendorRole()) {
            Long userId = currentUserId();
            try {
                Map<String, Object> profile = vendorClient.getVendorByUserId(userId);
                if (profile != null && profile.get("vendorId") != null) {
                    vendorId = ((Number) profile.get("vendorId")).longValue();
                }
            } catch (Exception e) {
                log.warn("Could not resolve vendorId from JWT for invoice submission, userId {}: {}", userId, e.getMessage());
            }
        }
        return ResponseEntity.ok(service.submitInvoice(request.getPoId(), request.getInvoiceAmount(), vendorId));
    }

    private boolean isVendorRole() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null) return false;
        return auth.getAuthorities().stream()
            .anyMatch(a -> a.getAuthority().startsWith("ROLE_VENDOR_"));
    }

    @GetMapping("/invoices/po/{poId}")
    public ResponseEntity<List<Invoice>> getInvoicesByPO(@PathVariable Long poId) {
        return ResponseEntity.ok(service.getInvoicesByPO(poId));
    }

    @GetMapping("/invoices")
    public ResponseEntity<PagedResponse<Invoice>> getAllInvoices(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String statuses,
            @RequestParam(required = false) Long vendorId,
            @RequestParam(required = false, defaultValue = "id-desc") String sort) {
        return ResponseEntity.ok(service.getAllInvoices(
            page, size, search, status, statuses, vendorId, sort));
    }

    @GetMapping("/invoices/vendor/{vendorId}")
    public ResponseEntity<List<Invoice>> getInvoicesByVendor(@PathVariable Long vendorId) {
        return ResponseEntity.ok(service.getInvoicesByVendor(vendorId));
    }

    @PostMapping("/invoices/{invoiceId}/validate")
    public ResponseEntity<Invoice> validateInvoice(
            @PathVariable Long invoiceId,
            @RequestParam BigDecimal expectedAmount,
            @RequestParam Integer expectedQuantity) {
        return ResponseEntity.ok(service.validateInvoice(invoiceId, expectedAmount, expectedQuantity));
    }

    @PostMapping("/invoices/{invoiceId}/dispute")
    public ResponseEntity<Invoice> disputeInvoice(
            @PathVariable Long invoiceId,
            @RequestParam String reason) {
        return ResponseEntity.ok(service.disputeInvoice(invoiceId, reason));
    }

    @PostMapping("/invoices/{invoiceId}/mark-paid")
    public ResponseEntity<Invoice> markInvoicePaid(@PathVariable Long invoiceId) {
        return ResponseEntity.ok(service.markInvoicePaid(invoiceId, currentUserId()));
    }

    // ── 3-Way Match ──────────────────────────────────────────────────────────

    @PostMapping("/threewaymatch/validate")
    public ResponseEntity<ThreeWayMatchResponse> performThreeWayMatch(
            @Valid @RequestBody ThreeWayMatchRequest request) {
        return ResponseEntity.ok(service.performThreeWayMatch(
                request.getPoId(),
                request.getDeliveryId(),
                request.getInvoiceId(),
                request.getPoAmount(),
                request.getPoQuantity()));
    }

    @GetMapping("/threewaymatch/po/{poId}")
    public ResponseEntity<ThreeWayMatchResponse> getThreeWayMatch(@PathVariable Long poId) {
        return ResponseEntity.ok(service.getThreeWayMatch(poId));
    }

    // ── Disputes ─────────────────────────────────────────────────────────────

    @PostMapping("/disputes")
    public ResponseEntity<DisputeResponse> raiseDispute(@Valid @RequestBody DisputeRequest request) {
        // userId and role come from the SecurityContext — validated JWT, not a header
        return ResponseEntity.ok(service.raiseDispute(request, currentUserId(), currentUserRole()));
    }

    @GetMapping("/disputes")
    public ResponseEntity<PagedResponse<DisputeResponse>> getAllDisputes(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {
        return ResponseEntity.ok(service.getAllDisputes(page, size));
    }

    @GetMapping("/disputes/{disputeId}")
    public ResponseEntity<DisputeResponse> getDispute(@PathVariable Long disputeId) {
        return ResponseEntity.ok(service.getDisputeById(disputeId));
    }

    @GetMapping("/disputes/status/{status}")
    public ResponseEntity<List<DisputeResponse>> getDisputesByStatus(@PathVariable String status) {
        return ResponseEntity.ok(service.getDisputesByStatus(status));
    }

    @PostMapping("/disputes/{disputeId}/resolve")
    public ResponseEntity<DisputeResponse> resolveDispute(
            @PathVariable Long disputeId,
            @Valid @RequestBody ResolutionRequest request) {
        return ResponseEntity.ok(service.resolveDispute(disputeId, request, currentUserId()));
    }
}
