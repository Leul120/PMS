package com.procurement.deliveryinvoiceservice.controller;

import com.procurement.deliveryinvoiceservice.dto.*;
import com.procurement.deliveryinvoiceservice.entity.Delivery;
import com.procurement.deliveryinvoiceservice.entity.Invoice;
import com.procurement.deliveryinvoiceservice.service.DeliveryInvoiceService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class DeliveryInvoiceController {
    
    private final DeliveryInvoiceService service;
    
    @PostMapping("/deliveries")
    public ResponseEntity<Delivery> createDelivery(
            @RequestParam Long poId,
            @RequestParam Long vendorId,
            @RequestParam LocalDate expectedDate,
            @RequestParam LocalDate actualDate,
            @RequestParam Integer quantityDelivered,
            @RequestParam(required = false) String issueNotes,
            @RequestParam(required = false) String qualityRemarks) {
        return ResponseEntity.ok(service.createDelivery(poId, vendorId, expectedDate, actualDate, 
            quantityDelivered, issueNotes, qualityRemarks));
    }
    
    @GetMapping("/deliveries/po/{poId}")
    public ResponseEntity<List<Delivery>> getDeliveriesByPO(@PathVariable Long poId) {
        return ResponseEntity.ok(service.getDeliveriesByPO(poId));
    }
    
    @GetMapping("/deliveries")
    public ResponseEntity<List<Delivery>> getAllDeliveries() {
        return ResponseEntity.ok(service.getAllDeliveries());
    }
    
    @PostMapping("/invoices")
    public ResponseEntity<Invoice> submitInvoice(
            @RequestParam Long poId,
            @RequestParam BigDecimal invoiceAmount,
            @RequestParam Long vendorId) {
        return ResponseEntity.ok(service.submitInvoice(poId, invoiceAmount, vendorId));
    }
    
    @GetMapping("/invoices/po/{poId}")
    public ResponseEntity<List<Invoice>> getInvoicesByPO(@PathVariable Long poId) {
        return ResponseEntity.ok(service.getInvoicesByPO(poId));
    }
    
    @GetMapping("/invoices")
    public ResponseEntity<List<Invoice>> getAllInvoices() {
        return ResponseEntity.ok(service.getAllInvoices());
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
    
    // 3-Way Match Endpoints
    @PostMapping("/threewaymatch/validate")
    public ResponseEntity<ThreeWayMatchResponse> performThreeWayMatch(
            @RequestParam Long poId,
            @RequestParam Long deliveryId,
            @RequestParam Long invoiceId,
            @RequestParam BigDecimal poAmount,
            @RequestParam Integer poQuantity) {
        return ResponseEntity.ok(service.performThreeWayMatch(poId, deliveryId, invoiceId, poAmount, poQuantity));
    }
    
    @GetMapping("/threewaymatch/po/{poId}")
    public ResponseEntity<ThreeWayMatchResponse> getThreeWayMatch(@PathVariable Long poId) {
        return ResponseEntity.ok(service.getThreeWayMatch(poId));
    }
    
    // Dispute Management Endpoints
    @PostMapping("/disputes")
    public ResponseEntity<DisputeResponse> raiseDispute(
            @Valid @RequestBody DisputeRequest request,
            @RequestHeader("X-User-Id") Long userId,
            @RequestHeader("X-User-Role") String userRole) {
        return ResponseEntity.ok(service.raiseDispute(request, userId, userRole));
    }
    
    @GetMapping("/disputes")
    public ResponseEntity<List<DisputeResponse>> getAllDisputes() {
        return ResponseEntity.ok(service.getAllDisputes());
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
