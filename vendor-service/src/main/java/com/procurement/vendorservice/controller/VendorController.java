package com.procurement.vendorservice.controller;

import com.procurement.vendorservice.dto.*;
import com.procurement.vendorservice.entity.VendorDocument;
import com.procurement.vendorservice.service.VendorService;
import com.procurement.vendorservice.tenant.TenantContext;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;
import java.util.Set;

@RestController
@RequestMapping("/api/vendors")
@RequiredArgsConstructor
public class VendorController {

    private static final long MAX_FILE_SIZE = 10L * 1024 * 1024;
    private static final Set<String> ALLOWED_TYPES = Set.of(
        "application/pdf", "image/png", "image/jpeg",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );

    private final VendorService vendorService;

    @PostMapping("/register")
    public ResponseEntity<VendorResponse> registerVendor(
            @Valid @RequestBody VendorRequest request) {
        return ResponseEntity.ok(vendorService.registerVendor(request, currentUserId()));
    }

    @GetMapping
    public ResponseEntity<PagedResponse<VendorResponse>> getAllVendors(
            @RequestParam(name = "page", defaultValue = "0") int page,
            @RequestParam(name = "size", defaultValue = "50") int size,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String status,
            @RequestParam(required = false, defaultValue = "name-asc") String sort) {
        return ResponseEntity.ok(vendorService.getAllVendors(page, size, search, status, sort));
    }

    @GetMapping("/{vendorId}")
    public ResponseEntity<VendorResponse> getVendor(@PathVariable Long vendorId) {
        return ResponseEntity.ok(vendorService.getVendor(vendorId));
    }

    @GetMapping("/user/{userId}")
    public ResponseEntity<VendorResponse> getVendorByUser(@PathVariable Long userId) {
        // Vendor roles may only look up their own profile
        if (isVendorRole() && !currentUserId().equals(userId)) {
            return ResponseEntity.status(403).build();
        }
        return ResponseEntity.ok(vendorService.getVendorByUserId(userId));
    }

    @PutMapping("/{vendorId}")
    public ResponseEntity<VendorResponse> updateVendor(
            @PathVariable Long vendorId,
            @Valid @RequestBody VendorRequest request) {
        return ResponseEntity.ok(vendorService.updateVendor(vendorId, request));
    }

    @PostMapping("/{vendorId}/verify")
    public ResponseEntity<VendorResponse> verifyVendor(@PathVariable Long vendorId) {
        return ResponseEntity.ok(vendorService.verifyVendor(vendorId, currentUserId()));
    }

    @GetMapping("/status/{status}")
    public ResponseEntity<List<VendorResponse>> getVendorsByStatus(@PathVariable String status) {
        return ResponseEntity.ok(vendorService.getVendorsByStatus(status));
    }

    @PostMapping("/batch")
    public ResponseEntity<List<VendorResponse>> getVendorsByIds(@RequestBody List<Long> vendorIds) {
        return ResponseEntity.ok(vendorService.getVendorsByIds(vendorIds));
    }

    @GetMapping("/by-tenant/{tenantId}/ids")
    public ResponseEntity<List<Long>> getVendorIdsByTenantId(@PathVariable Long tenantId) {
        return ResponseEntity.ok(vendorService.getVendorIdsByTenantId(tenantId));
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

    @PostMapping(value = "/{vendorId}/documents", consumes = {MediaType.MULTIPART_FORM_DATA_VALUE})
    public ResponseEntity<VendorDocumentResponse> uploadDocument(
            @PathVariable Long vendorId,
            @RequestPart("file") MultipartFile file,
            @RequestPart("documentType") String documentType,
            @RequestPart("documentName") String documentName,
            @RequestPart(value = "issueDate", required = false) String issueDate,
            @RequestPart("expiryDate") String expiryDate) throws IOException {

        // Vendors may only upload documents for their own vendor profile
        if (isVendorRole()) {
            VendorResponse own = vendorService.getVendorByUserId(currentUserId());
            if (!own.getVendorId().equals(vendorId)) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
            }
        }

        if (file.isEmpty()) throw new IllegalArgumentException("File must not be empty");
        if (file.getSize() > MAX_FILE_SIZE) throw new IllegalArgumentException("File size exceeds the 10 MB limit");
        String ct = file.getContentType();
        if (ct == null || !ALLOWED_TYPES.contains(ct))
            throw new IllegalArgumentException("File type not allowed. Only PDF, PNG, JPG, and DOCX are accepted");

        VendorDocumentRequest request = new VendorDocumentRequest();
        request.setDocumentType(documentType);
        request.setDocumentName(documentName);
        request.setIssueDate(issueDate != null && !issueDate.isBlank()
            ? java.time.LocalDate.parse(issueDate) : null);
        request.setExpiryDate(java.time.LocalDate.parse(expiryDate));

        return ResponseEntity.ok(vendorService.uploadDocument(
            vendorId, request, currentUserId().toString(),
            file.getBytes(), file.getContentType(), file.getOriginalFilename()));
    }

    @GetMapping("/documents/{documentId}/file")
    public ResponseEntity<byte[]> downloadDocument(@PathVariable Long documentId) {
        VendorDocument doc = vendorService.getDocumentEntity(documentId);
        byte[] content = doc.getFileContent();
        if (content == null || content.length == 0) {
            return ResponseEntity.notFound().build();
        }
        String ct = doc.getContentType() != null ? doc.getContentType() : "application/octet-stream";
        String filename = doc.getOriginalFilename() != null ? doc.getOriginalFilename() : "document";
        return ResponseEntity.ok()
            .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
            .contentType(MediaType.parseMediaType(ct))
            .body(content);
    }

    @GetMapping("/{vendorId}/documents")
    public ResponseEntity<List<VendorDocumentResponse>> getVendorDocuments(@PathVariable Long vendorId) {
        // Vendors may only list their own documents
        if (isVendorRole()) {
            VendorResponse own = vendorService.getVendorByUserId(currentUserId());
            if (!own.getVendorId().equals(vendorId)) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
            }
        }
        return ResponseEntity.ok(vendorService.getVendorDocuments(vendorId));
    }

    @GetMapping("/documents/expiring")
    public ResponseEntity<List<VendorDocumentResponse>> getExpiringDocuments(
            @RequestParam String date) {
        return ResponseEntity.ok(vendorService.getExpiringDocuments(java.time.LocalDate.parse(date)));
    }

    @DeleteMapping("/documents/{documentId}")
    public ResponseEntity<Void> deleteDocument(@PathVariable Long documentId) {
        // Vendors may only delete their own documents
        if (isVendorRole()) {
            VendorDocument doc = vendorService.getDocumentEntity(documentId);
            VendorResponse own = vendorService.getVendorByUserId(currentUserId());
            if (!doc.getVendor().getVendorId().equals(own.getVendorId())) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
            }
        }
        vendorService.deleteDocument(documentId);
        return ResponseEntity.ok().build();
    }

    @PutMapping("/{vendorId}/status")
    public ResponseEntity<VendorResponse> updateVendorStatus(
            @PathVariable Long vendorId,
            @RequestParam String status) {
        return ResponseEntity.ok(vendorService.updateVendorStatus(vendorId, status));
    }

    @PostMapping("/init-profile")
    public ResponseEntity<VendorResponse> initVendorProfile(
            @RequestBody(required = false) VendorInitRequest initRequest) {
        Long tenantId = TenantContext.getCurrentTenant();
        if (tenantId == null) throw new IllegalStateException("Tenant context missing");
        return ResponseEntity.ok(vendorService.initVendorProfile(currentUserId(), tenantId,
                initRequest != null ? initRequest.getCompanyName() : null,
                initRequest != null ? initRequest.getEmail() : null));
    }

    private Long currentUserId() {
        return (Long) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
    }

    private boolean isVendorRole() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null) return false;
        return auth.getAuthorities().stream()
            .anyMatch(a -> a.getAuthority().startsWith("ROLE_VENDOR_"));
    }
}
