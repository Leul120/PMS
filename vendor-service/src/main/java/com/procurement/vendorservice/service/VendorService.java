package com.procurement.vendorservice.service;

import com.procurement.vendorservice.dto.*;
import com.procurement.vendorservice.entity.Vendor;
import com.procurement.vendorservice.entity.VendorCategory;
import com.procurement.vendorservice.entity.VendorDocument;
import com.procurement.vendorservice.event.VendorVerifiedEvent;
import com.procurement.vendorservice.repository.VendorCategoryRepository;
import com.procurement.vendorservice.repository.VendorDocumentRepository;
import com.procurement.vendorservice.repository.VendorRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class VendorService {
    
    private final VendorRepository vendorRepository;
    private final VendorCategoryRepository categoryRepository;
    private final VendorDocumentRepository documentRepository;
    private final KafkaTemplate<String, Object> kafkaTemplate;
    
    @Transactional
    public VendorResponse registerVendor(VendorRequest request, Long userId) {
        if (vendorRepository.existsByEmail(request.getEmail())) {
            throw new RuntimeException("Vendor with this email already exists");
        }
        
        VendorCategory category = categoryRepository.findById(request.getCategoryId())
            .orElseThrow(() -> new RuntimeException("Category not found"));
        
        Vendor vendor = new Vendor();
        vendor.setCompanyName(request.getCompanyName());
        vendor.setContactPerson(request.getContactPerson());
        vendor.setEmail(request.getEmail());
        vendor.setCategory(category);
        vendor.setComplianceStatus("Pending");
        vendor.setUserId(userId);
        vendor.setPhoneNumber(request.getPhoneNumber());
        vendor.setAddress(request.getAddress());
        vendor.setTaxId(request.getTaxId());
        
        Vendor savedVendor = vendorRepository.save(vendor);
        log.info("Vendor registered: {}", savedVendor.getVendorId());
        
        return mapToVendorResponse(savedVendor);
    }
    
    public PagedResponse<VendorResponse> getAllVendors(int page, int size) {
        Page<Vendor> vendorPage = vendorRepository.findAll(
            PageRequest.of(page, size, Sort.unsorted()));
        return PagedResponse.<VendorResponse>builder()
            .content(vendorPage.getContent().stream().map(this::mapToVendorResponse).collect(Collectors.toList()))
            .page(vendorPage.getNumber())
            .size(vendorPage.getSize())
            .totalElements(vendorPage.getTotalElements())
            .totalPages(vendorPage.getTotalPages())
            .last(vendorPage.isLast())
            .build();
    }
    
    public VendorResponse getVendor(Long vendorId) {
        Vendor vendor = vendorRepository.findById(vendorId)
            .orElseThrow(() -> new RuntimeException("Vendor not found"));
        return mapToVendorResponse(vendor);
    }
    
    public VendorResponse getVendorByUserId(Long userId) {
        Vendor vendor = vendorRepository.findByUserId(userId)
            .orElseThrow(() -> new RuntimeException("Vendor not found for user"));
        return mapToVendorResponse(vendor);
    }
    
    @Transactional
    public VendorResponse updateVendor(Long vendorId, VendorRequest request) {
        Vendor vendor = vendorRepository.findById(vendorId)
            .orElseThrow(() -> new RuntimeException("Vendor not found"));
        
        VendorCategory category = categoryRepository.findById(request.getCategoryId())
            .orElseThrow(() -> new RuntimeException("Category not found"));
        
        vendor.setCompanyName(request.getCompanyName());
        vendor.setContactPerson(request.getContactPerson());
        vendor.setCategory(category);
        vendor.setPhoneNumber(request.getPhoneNumber());
        vendor.setAddress(request.getAddress());
        vendor.setTaxId(request.getTaxId());
        
        Vendor updatedVendor = vendorRepository.save(vendor);
        log.info("Vendor updated: {}", vendorId);
        
        return mapToVendorResponse(updatedVendor);
    }
    
    @Transactional
    public VendorResponse verifyVendor(Long vendorId, Long verifiedByUserId) {
        Vendor vendor = vendorRepository.findById(vendorId)
            .orElseThrow(() -> new RuntimeException("Vendor not found"));

        vendor.setComplianceStatus("Verified");
        Vendor verifiedVendor = vendorRepository.save(vendor);

        VendorVerifiedEvent event = VendorVerifiedEvent.builder()
            .vendorId(vendor.getVendorId())
            .companyName(vendor.getCompanyName())
            .email(vendor.getEmail())
            .verifiedBy(verifiedByUserId != null ? verifiedByUserId.toString() : "SYSTEM")
            .verifiedAt(LocalDateTime.now())
            .build();

        kafkaTemplate.send("vendor.verified", event);
        log.info("Vendor {} verified by user {}", vendorId, verifiedByUserId);

        return mapToVendorResponse(verifiedVendor);
    }
    
    public List<VendorResponse> getVendorsByStatus(String status) {
        return vendorRepository.findByComplianceStatus(status).stream()
            .map(this::mapToVendorResponse)
            .collect(Collectors.toList());
    }

    public List<VendorResponse> getVendorsByIds(List<Long> vendorIds) {
        if (vendorIds == null || vendorIds.isEmpty()) return List.of();
        return vendorRepository.findAllById(vendorIds).stream()
            .map(this::mapToVendorResponse)
            .collect(Collectors.toList());
    }
    
    public List<VendorCategoryResponse> getAllCategories() {
        return categoryRepository.findAll().stream()
            .map(this::mapToCategoryResponse)
            .collect(Collectors.toList());
    }

    public VendorCategoryResponse getCategoryById(Long categoryId) {
        VendorCategory category = categoryRepository.findById(categoryId)
            .orElseThrow(() -> new RuntimeException("Category not found: " + categoryId));
        return mapToCategoryResponse(category);
    }
    
    @Transactional
    public VendorCategoryResponse createCategory(VendorCategoryRequest request) {
        Long nextId = categoryRepository.count() + 1;
        
        VendorCategory category = new VendorCategory();
        category.setCategoryId(nextId);
        category.setCategoryName(request.getCategoryName());
        category.setDescription(request.getDescription());
        
        VendorCategory savedCategory = categoryRepository.save(category);
        log.info("Category created: {}", savedCategory.getCategoryId());
        
        return mapToCategoryResponse(savedCategory);
    }
    
    private VendorResponse mapToVendorResponse(Vendor vendor) {
        String compliance = vendor.getComplianceStatus();
        boolean isVerified = "Verified".equalsIgnoreCase(compliance);
        return VendorResponse.builder()
            .vendorId(vendor.getVendorId())
            .id(vendor.getVendorId())
            .companyName(vendor.getCompanyName())
            .contactPerson(vendor.getContactPerson())
            .email(vendor.getEmail())
            .categoryId(vendor.getCategory().getCategoryId())
            .categoryName(vendor.getCategory().getCategoryName())
            .category(vendor.getCategory().getCategoryName())
            .complianceStatus(compliance)
            .status(isVerified ? "ACTIVE" : "PENDING")
            .verified(isVerified)
            .phoneNumber(vendor.getPhoneNumber())
            .phone(vendor.getPhoneNumber())
            .address(vendor.getAddress())
            .taxId(vendor.getTaxId())
            .build();
    }
    
    private VendorCategoryResponse mapToCategoryResponse(VendorCategory category) {
        return VendorCategoryResponse.builder()
            .categoryId(category.getCategoryId())
            .categoryName(category.getCategoryName())
            .description(category.getDescription())
            .build();
    }
    
    @Transactional
    public VendorDocumentResponse uploadDocument(Long vendorId, VendorDocumentRequest request, String uploadedBy) {
        Vendor vendor = vendorRepository.findById(vendorId)
            .orElseThrow(() -> new RuntimeException("Vendor not found"));
        
        VendorDocument document = new VendorDocument();
        document.setVendor(vendor);
        document.setDocumentType(request.getDocumentType());
        document.setDocumentName(request.getDocumentName());
        document.setFileUrl(request.getFileUrl());
        document.setIssueDate(request.getIssueDate());
        document.setExpiryDate(request.getExpiryDate());
        document.setStatus("VALID");
        document.setUploadedAt(LocalDateTime.now());
        document.setUploadedBy(uploadedBy);
        
        VendorDocument savedDocument = documentRepository.save(document);
        log.info("Document uploaded for vendor {}: {}", vendorId, document.getDocumentName());
        
        return mapToDocumentResponse(savedDocument);
    }
    
    public List<VendorDocumentResponse> getVendorDocuments(Long vendorId) {
        return documentRepository.findByVendorVendorId(vendorId).stream()
            .map(this::mapToDocumentResponse)
            .collect(Collectors.toList());
    }
    
    public List<VendorDocumentResponse> getExpiringDocuments(java.time.LocalDate date) {
        return documentRepository.findByExpiryDateBefore(date).stream()
            .map(this::mapToDocumentResponse)
            .collect(Collectors.toList());
    }
    
    @Transactional
    public void deleteDocument(Long documentId) {
        documentRepository.deleteById(documentId);
        log.info("Document deleted: {}", documentId);
    }
    
    @Transactional
    public VendorResponse updateVendorStatus(Long vendorId, String status) {
        Vendor vendor = vendorRepository.findById(vendorId)
            .orElseThrow(() -> new RuntimeException("Vendor not found"));
        
        vendor.setComplianceStatus(status);
        Vendor updatedVendor = vendorRepository.save(vendor);
        log.info("Vendor status updated: {} to {}", vendorId, status);
        
        return mapToVendorResponse(updatedVendor);
    }
    
    private VendorDocumentResponse mapToDocumentResponse(VendorDocument document) {
        return VendorDocumentResponse.builder()
            .documentId(document.getDocumentId())
            .vendorId(document.getVendor().getVendorId())
            .documentType(document.getDocumentType())
            .documentName(document.getDocumentName())
            .fileUrl(document.getFileUrl())
            .issueDate(document.getIssueDate())
            .expiryDate(document.getExpiryDate())
            .status(document.getStatus())
            .uploadedAt(document.getUploadedAt())
            .uploadedBy(document.getUploadedBy())
            .build();
    }
}


