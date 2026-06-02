package com.procurement.vendorservice.service;

import com.procurement.vendorservice.dto.*;
import com.procurement.vendorservice.entity.Vendor;
import com.procurement.vendorservice.entity.VendorCategory;
import com.procurement.vendorservice.entity.VendorDocument;
import com.procurement.vendorservice.event.VendorVerifiedEvent;
import com.procurement.vendorservice.repository.VendorCategoryRepository;
import com.procurement.vendorservice.repository.VendorDocumentRepository;
import com.procurement.vendorservice.repository.VendorRepository;
import com.procurement.vendorservice.repository.VendorSpecifications;
import com.procurement.vendorservice.tenant.TenantContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
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
        Long currentTenantId = TenantContext.getCurrentTenant();
        if (currentTenantId != null && vendorRepository.existsByEmailAndTenantId(request.getEmail(), currentTenantId)) {
            throw new RuntimeException("A vendor with this email already exists in your organisation");
        }
        
        VendorCategory category = categoryRepository.findById(request.getCategoryId())
            .orElseThrow(() -> new RuntimeException("Category not found"));
        
        Vendor vendor = new Vendor();
        Long tenantId = TenantContext.getCurrentTenant();
        if (tenantId == null) {
            throw new IllegalStateException("Tenant context is required. Ensure request is authenticated.");
        }
        vendor.setTenantId(tenantId);
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
    
    @Transactional(readOnly = true)
    public PagedResponse<VendorResponse> getAllVendors(
            int page,
            int size,
            String search,
            String status,
            String sort) {
        Specification<Vendor> spec = VendorSpecifications.combine(search, status);
        Page<Vendor> vendorPage = vendorRepository.findAll(
            spec, PageRequest.of(page, size, resolveVendorSort(sort)));
        return PagedResponse.<VendorResponse>builder()
            .content(vendorPage.getContent().stream().map(this::mapToVendorResponse).collect(Collectors.toList()))
            .page(vendorPage.getNumber())
            .size(vendorPage.getSize())
            .totalElements(vendorPage.getTotalElements())
            .totalPages(vendorPage.getTotalPages())
            .last(vendorPage.isLast())
            .build();
    }

    private Sort resolveVendorSort(String sort) {
        if (sort == null || sort.isBlank()) {
            return Sort.by(Sort.Direction.ASC, "companyName");
        }
        return switch (sort) {
            case "name-desc" -> Sort.by(Sort.Direction.DESC, "companyName");
            case "id-desc" -> Sort.by(Sort.Direction.DESC, "vendorId");
            case "id-asc" -> Sort.by(Sort.Direction.ASC, "vendorId");
            default -> Sort.by(Sort.Direction.ASC, "companyName");
        };
    }
    
    @Transactional(readOnly = true)
    public VendorResponse getVendor(Long vendorId) {
        Vendor vendor = vendorRepository.findById(vendorId)
            .orElseThrow(() -> new RuntimeException("Vendor not found"));
        return mapToVendorResponse(vendor);
    }
    
    @Transactional(readOnly = true)
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
            .tenantId(vendor.getTenantId())
            .vendorId(vendor.getVendorId())
            .companyName(vendor.getCompanyName())
            .email(vendor.getEmail())
            .verifiedBy(verifiedByUserId != null ? verifiedByUserId.toString() : "SYSTEM")
            .verifiedAt(LocalDateTime.now())
            .build();

        kafkaTemplate.send("vendor.verified", event)
            .whenComplete((result, ex) -> {
                if (ex != null) log.error("Failed to publish vendor.verified event for vendor {}: {}", vendorId, ex.getMessage());
            });
        log.info("Vendor {} verified by user {}", vendorId, verifiedByUserId);

        return mapToVendorResponse(verifiedVendor);
    }
    
    @Transactional(readOnly = true)
    public List<VendorResponse> getVendorsByStatus(String status) {
        return vendorRepository.findByComplianceStatus(status).stream()
            .map(this::mapToVendorResponse)
            .collect(Collectors.toList());
    }

    @Transactional
    public VendorResponse initVendorProfile(Long userId, Long tenantId, String companyName, String email) {
        return vendorRepository.findByUserId(userId).map(this::mapToVendorResponse).orElseGet(() -> {
            // Pick an email that won't violate the tenant-scoped uniqueness constraint
            String resolvedEmail = email != null ? email : userId + "@vendor.local";
            if (vendorRepository.existsByEmailAndTenantId(resolvedEmail, tenantId)) {
                resolvedEmail = userId + "@vendor.local";
                if (vendorRepository.existsByEmailAndTenantId(resolvedEmail, tenantId)) {
                    resolvedEmail = "vendor-" + userId + "-" + tenantId + "@vendor.local";
                }
            }

            Vendor stub = new Vendor();
            stub.setUserId(userId);
            stub.setTenantId(tenantId);
            stub.setCompanyName(companyName != null ? companyName : "Vendor " + userId);
            stub.setEmail(resolvedEmail);
            stub.setContactPerson("");
            stub.setComplianceStatus("Pending");
            // Assign to the first available category as a placeholder (may be null — mapToVendorResponse is null-safe)
            categoryRepository.findAll().stream().findFirst().ifPresent(stub::setCategory);
            Vendor saved = vendorRepository.save(stub);
            log.info("Stub vendor profile created for userId={}, tenantId={}", userId, tenantId);
            return mapToVendorResponse(saved);
        });
    }

    @Transactional(readOnly = true)
    public List<VendorResponse> getVendorsByIds(List<Long> vendorIds) {
        if (vendorIds == null || vendorIds.isEmpty()) return List.of();
        return vendorRepository.findAllById(vendorIds).stream()
            .map(this::mapToVendorResponse)
            .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<Long> getVendorIdsByTenantId(Long tenantId) {
        return vendorRepository.findByTenantId(tenantId).stream()
            .map(Vendor::getVendorId)
            .collect(Collectors.toList());
    }
    
    @Cacheable(value = "vendorCategories", key = "'all'")
    @Transactional(readOnly = true)
    public List<VendorCategoryResponse> getAllCategories() {
        return categoryRepository.findAll().stream()
            .map(this::mapToCategoryResponse)
            .collect(Collectors.toList());
    }

    @Cacheable(value = "vendorCategories", key = "#categoryId")
    @Transactional(readOnly = true)
    public VendorCategoryResponse getCategoryById(Long categoryId) {
        VendorCategory category = categoryRepository.findById(categoryId)
            .orElseThrow(() -> new RuntimeException("Category not found: " + categoryId));
        return mapToCategoryResponse(category);
    }

    @CacheEvict(value = "vendorCategories", allEntries = true)
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
        VendorCategory cat = vendor.getCategory();
        return VendorResponse.builder()
            .vendorId(vendor.getVendorId())
            .id(vendor.getVendorId())
            .companyName(vendor.getCompanyName())
            .contactPerson(vendor.getContactPerson())
            .email(vendor.getEmail())
            .categoryId(cat != null ? cat.getCategoryId() : null)
            .categoryName(cat != null ? cat.getCategoryName() : null)
            .category(cat != null ? cat.getCategoryName() : null)
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
    public VendorDocumentResponse uploadDocument(Long vendorId, VendorDocumentRequest request,
                                                  String uploadedBy, byte[] fileContent,
                                                  String contentType, String originalFilename) {
        Vendor vendor = vendorRepository.findById(vendorId)
            .orElseThrow(() -> new RuntimeException("Vendor not found"));

        Long tenantId = TenantContext.getCurrentTenant();
        if (tenantId == null) {
            throw new IllegalStateException("Tenant context is required. Ensure request is authenticated.");
        }

        VendorDocument document = new VendorDocument();
        document.setTenantId(tenantId);
        document.setVendor(vendor);
        document.setDocumentType(request.getDocumentType());
        document.setDocumentName(request.getDocumentName());
        document.setFileContent(fileContent);
        document.setContentType(contentType);
        document.setOriginalFilename(originalFilename);
        document.setIssueDate(request.getIssueDate());
        document.setExpiryDate(request.getExpiryDate());
        document.setStatus("VALID");
        document.setUploadedAt(LocalDateTime.now());
        document.setUploadedBy(uploadedBy);

        VendorDocument savedDocument = documentRepository.save(document);
        log.info("Document stored in DB for vendor {}: {}", vendorId, document.getDocumentName());

        return mapToDocumentResponse(savedDocument);
    }
    
    @Transactional(readOnly = true)
    public List<VendorDocumentResponse> getVendorDocuments(Long vendorId) {
        return documentRepository.findByVendorVendorId(vendorId).stream()
            .map(this::mapToDocumentResponse)
            .collect(Collectors.toList());
    }
    
    @Transactional(readOnly = true)
    public List<VendorDocumentResponse> getExpiringDocuments(java.time.LocalDate date) {
        return documentRepository.findByExpiryDateBefore(date).stream()
            .map(this::mapToDocumentResponse)
            .collect(Collectors.toList());
    }
    
    @Transactional(readOnly = true)
    public VendorDocumentResponse getDocument(Long documentId) {
        VendorDocument doc = documentRepository.findById(documentId)
            .orElseThrow(() -> new RuntimeException("Document not found"));
        return mapToDocumentResponse(doc);
    }

    @Transactional(readOnly = true)
    public VendorDocument getDocumentEntity(Long documentId) {
        return documentRepository.findById(documentId)
            .orElseThrow(() -> new RuntimeException("Document not found"));
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
            .originalFilename(document.getOriginalFilename())
            .contentType(document.getContentType())
            .issueDate(document.getIssueDate())
            .expiryDate(document.getExpiryDate())
            .status(document.getStatus())
            .uploadedAt(document.getUploadedAt())
            .uploadedBy(document.getUploadedBy())
            .build();
    }
}


