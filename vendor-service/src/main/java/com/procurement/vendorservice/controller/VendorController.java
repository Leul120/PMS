package com.procurement.vendorservice.controller;

import com.procurement.vendorservice.dto.*;
import com.procurement.vendorservice.service.VendorService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/vendors")
@RequiredArgsConstructor
public class VendorController {
    
    private final VendorService vendorService;
    
    @PostMapping("/register")
    @PreAuthorize("hasAnyRole('ADMIN', 'OFFICER', 'VENDOR')")
    public ResponseEntity<VendorResponse> registerVendor(
            @Valid @RequestBody VendorRequest request,
            @RequestHeader("X-User-Id") Long userId) {
        return ResponseEntity.ok(vendorService.registerVendor(request, userId));
    }
    
    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'OFFICER', 'MANAGER', 'AUDITOR')")
    public ResponseEntity<List<VendorResponse>> getAllVendors() {
        return ResponseEntity.ok(vendorService.getAllVendors());
    }
    
    @GetMapping("/{vendorId}")
    @PreAuthorize("hasAnyRole('ADMIN', 'OFFICER', 'MANAGER', 'AUDITOR', 'VENDOR')")
    public ResponseEntity<VendorResponse> getVendor(@PathVariable Long vendorId) {
        return ResponseEntity.ok(vendorService.getVendor(vendorId));
    }
    
    @GetMapping("/user/{userId}")
    @PreAuthorize("hasAnyRole('ADMIN', 'OFFICER', 'MANAGER', 'AUDITOR', 'VENDOR')")
    public ResponseEntity<VendorResponse> getVendorByUser(@PathVariable Long userId) {
        return ResponseEntity.ok(vendorService.getVendorByUserId(userId));
    }
    
    @PutMapping("/{vendorId}")
    @PreAuthorize("hasAnyRole('ADMIN', 'OFFICER', 'VENDOR')")
    public ResponseEntity<VendorResponse> updateVendor(
            @PathVariable Long vendorId,
            @Valid @RequestBody VendorRequest request) {
        return ResponseEntity.ok(vendorService.updateVendor(vendorId, request));
    }
    
    @PostMapping("/{vendorId}/verify")
    @PreAuthorize("hasAnyRole('ADMIN', 'OFFICER')")
    public ResponseEntity<VendorResponse> verifyVendor(@PathVariable Long vendorId) {
        return ResponseEntity.ok(vendorService.verifyVendor(vendorId));
    }
    
    @GetMapping("/status/{status}")
    @PreAuthorize("hasAnyRole('ADMIN', 'OFFICER', 'MANAGER', 'AUDITOR')")
    public ResponseEntity<List<VendorResponse>> getVendorsByStatus(@PathVariable String status) {
        return ResponseEntity.ok(vendorService.getVendorsByStatus(status));
    }
    
    @GetMapping("/categories")
    @PreAuthorize("hasAnyRole('ADMIN', 'OFFICER', 'MANAGER', 'AUDITOR', 'VENDOR')")
    public ResponseEntity<List<VendorCategoryResponse>> getAllCategories() {
        return ResponseEntity.ok(vendorService.getAllCategories());
    }
    
    @PostMapping("/categories")
    @PreAuthorize("hasAnyRole('ADMIN', 'OFFICER')")
    public ResponseEntity<VendorCategoryResponse> createCategory(
            @Valid @RequestBody VendorCategoryRequest request) {
        return ResponseEntity.ok(vendorService.createCategory(request));
    }
    
    @PostMapping("/{vendorId}/documents")
    @PreAuthorize("hasAnyRole('ADMIN', 'OFFICER', 'VENDOR')")
    public ResponseEntity<VendorDocumentResponse> uploadDocument(
            @PathVariable Long vendorId,
            @Valid @RequestBody VendorDocumentRequest request,
            @RequestHeader("X-User-Id") Long userId) {
        return ResponseEntity.ok(vendorService.uploadDocument(vendorId, request, userId.toString()));
    }
    
    @GetMapping("/{vendorId}/documents")
    @PreAuthorize("hasAnyRole('ADMIN', 'OFFICER', 'MANAGER', 'AUDITOR', 'VENDOR')")
    public ResponseEntity<List<VendorDocumentResponse>> getVendorDocuments(@PathVariable Long vendorId) {
        return ResponseEntity.ok(vendorService.getVendorDocuments(vendorId));
    }
    
    @GetMapping("/documents/expiring")
    @PreAuthorize("hasAnyRole('ADMIN', 'OFFICER', 'MANAGER')")
    public ResponseEntity<List<VendorDocumentResponse>> getExpiringDocuments(
            @RequestParam String date) {
        return ResponseEntity.ok(vendorService.getExpiringDocuments(java.time.LocalDate.parse(date)));
    }
    
    @DeleteMapping("/documents/{documentId}")
    @PreAuthorize("hasAnyRole('ADMIN', 'OFFICER')")
    public ResponseEntity<Void> deleteDocument(@PathVariable Long documentId) {
        vendorService.deleteDocument(documentId);
        return ResponseEntity.ok().build();
    }
    
    @PutMapping("/{vendorId}/status")
    @PreAuthorize("hasAnyRole('ADMIN', 'OFFICER')")
    public ResponseEntity<VendorResponse> updateVendorStatus(
            @PathVariable Long vendorId,
            @RequestParam String status) {
        return ResponseEntity.ok(vendorService.updateVendorStatus(vendorId, status));
    }
}
