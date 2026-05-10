package com.procurement.deliveryinvoiceservice.controller;

import com.procurement.deliveryinvoiceservice.dto.*;
import com.procurement.deliveryinvoiceservice.entity.Delivery;
import com.procurement.deliveryinvoiceservice.entity.Invoice;
import com.procurement.deliveryinvoiceservice.service.DeliveryInvoiceService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;
@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class DeliveryInvoiceController {

    private final DeliveryInvoiceService service;

    // ── Deliveries ──────────────────────────────────────────────────────────

    @PostMapping("/deliveries")
    public ResponseEntity<Delivery> createDelivery(@Valid @RequestBody DeliveryRequest request) {
        return ResponseEntity.ok(service.createDelivery(
                request.getPoId(),
                request.getVendorId(),
                request.getExpectedDate(),
                request.getActualDate(),
                request.getQuantityDelivered(),
                request.getIssueNotes(),
                request.getQualityRemarks()));
    }

    @GetMapping("/deliveries/po/{poId}")
    public ResponseEntity<List<Delivery>> getDeliveriesByPO(@PathVariable Long poId) {
        return ResponseEntity.ok(service.getDeliveriesByPO(poId));
    }

    @GetMapping("/deliveries")
    public ResponseEntity<PagedResponse<Delivery>> getAllDeliveries(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {
        return ResponseEntity.ok(service.getAllDeliveries(page, size));
    }

    // ── Invoices ─────────────────────────────────────────────────────────────

    @PostMapping("/invoices")
    public ResponseEntity<Invoice> submitInvoice(@Valid @RequestBody InvoiceRequest request) {
        return ResponseEntity.ok(service.submitInvoice(
                request.getPoId(),
                request.getInvoiceAmount(),
                request.getVendorId()));
    }

    @GetMapping("/invoices/po/{poId}")
    public ResponseEntity<List<Invoice>> getInvoicesByPO(@PathVariable Long poId) {
        return ResponseEntity.ok(service.getInvoicesByPO(poId));
    }

    @GetMapping("/invoices")
    public ResponseEntity<PagedResponse<Invoice>> getAllInvoices(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {
        return ResponseEntity.ok(service.getAllInvoices(page, size));
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
    public ResponseEntity<DisputeResponse> raiseDispute(
            @Valid @RequestBody DisputeRequest request,
            @RequestHeader("X-User-Id") Long userId) {
        String userRole = SecurityContextHolder.getContext().getAuthentication()
            .getAuthorities().stream().findFirst()
            .map(a -> a.getAuthority().replace("ROLE_", ""))
            .orElse("OFFICER");
        return ResponseEntity.ok(service.raiseDispute(request, userId, userRole));
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
            @Valid @RequestBody ResolutionRequest request,
            @RequestHeader("X-User-Id") Long userId) {
        return ResponseEntity.ok(service.resolveDispute(disputeId, request, userId));
    }
}
