package com.procurement.vendorservice.controller;

import com.procurement.vendorservice.dto.*;
import com.procurement.vendorservice.service.VendorService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/vendors")
@RequiredArgsConstructor
public class VendorController {

    private final VendorService vendorService;

    @PostMapping("/register")
    public ResponseEntity<VendorResponse> registerVendor(
            @Valid @RequestBody VendorRequest request,
            @RequestHeader("X-User-Id") Long userId) {
        return ResponseEntity.ok(vendorService.registerVendor(request, userId));
    }

    @GetMapping
    public ResponseEntity<PagedResponse<VendorResponse>> getAllVendors(
            @RequestParam(name = "page", defaultValue = "0") int page,
            @RequestParam(name = "size", defaultValue = "50") int size) {
        return ResponseEntity.ok(vendorService.getAllVendors(page, size));
    }

    @GetMapping("/{vendorId}")
    public ResponseEntity<VendorResponse> getVendor(@PathVariable Long vendorId) {
        return ResponseEntity.ok(vendorService.getVendor(vendorId));
    }

    @GetMapping("/user/{userId}")
    public ResponseEntity<VendorResponse> getVendorByUser(@PathVariable Long userId) {
        return ResponseEntity.ok(vendorService.getVendorByUserId(userId));
    }

    @PutMapping("/{vendorId}")
    public ResponseEntity<VendorResponse> updateVendor(
            @PathVariable Long vendorId,
            @Valid @RequestBody VendorRequest request) {
        return ResponseEntity.ok(vendorService.updateVendor(vendorId, request));
    }

    @PostMapping("/{vendorId}/verify")
    public ResponseEntity<VendorResponse> verifyVendor(
            @PathVariable Long vendorId,
            @RequestHeader("X-User-Id") Long verifiedByUserId) {
        return ResponseEntity.ok(vendorService.verifyVendor(vendorId, verifiedByUserId));
    }

    @GetMapping("/status/{status}")
    public ResponseEntity<List<VendorResponse>> getVendorsByStatus(@PathVariable String status) {
        return ResponseEntity.ok(vendorService.getVendorsByStatus(status));
    }

    @GetMapping("/categories")
    public ResponseEntity<List<VendorCategoryResponse>> getAllCategories() {
        return ResponseEntity.ok(vendorService.getAllCategories());
    }

    @GetMapping("/categories/{categoryId}")
    public ResponseEntity<VendorCategoryResponse> getCategoryById(@PathVariable Long categoryId) {
        return ResponseEntity.ok(vendorService.getCategoryById(categoryId));
    }

    @PostMapping("/categories")
    public ResponseEntity<VendorCategoryResponse> createCategory(
            @Valid @RequestBody VendorCategoryRequest request) {
        return ResponseEntity.ok(vendorService.createCategory(request));
    }

    @PostMapping("/{vendorId}/documents")
    public ResponseEntity<VendorDocumentResponse> uploadDocument(
            @PathVariable Long vendorId,
            @Valid @RequestBody VendorDocumentRequest request,
            @RequestHeader("X-User-Id") Long userId) {
        return ResponseEntity.ok(vendorService.uploadDocument(vendorId, request, userId.toString()));
    }

    @GetMapping("/{vendorId}/documents")
    public ResponseEntity<List<VendorDocumentResponse>> getVendorDocuments(@PathVariable Long vendorId) {
        return ResponseEntity.ok(vendorService.getVendorDocuments(vendorId));
    }

    @GetMapping("/documents/expiring")
    public ResponseEntity<List<VendorDocumentResponse>> getExpiringDocuments(
            @RequestParam String date) {
        return ResponseEntity.ok(vendorService.getExpiringDocuments(java.time.LocalDate.parse(date)));
    }

    @DeleteMapping("/documents/{documentId}")
    public ResponseEntity<Void> deleteDocument(@PathVariable Long documentId) {
        vendorService.deleteDocument(documentId);
        return ResponseEntity.ok().build();
    }

    @PutMapping("/{vendorId}/status")
    public ResponseEntity<VendorResponse> updateVendorStatus(
            @PathVariable Long vendorId,
            @RequestParam String status) {
        return ResponseEntity.ok(vendorService.updateVendorStatus(vendorId, status));
    }
}
