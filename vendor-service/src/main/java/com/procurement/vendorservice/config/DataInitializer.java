package com.procurement.vendorservice.config;

import com.procurement.vendorservice.entity.Vendor;
import com.procurement.vendorservice.entity.VendorCategory;
import com.procurement.vendorservice.entity.VendorDocument;
import com.procurement.vendorservice.repository.VendorCategoryRepository;
import com.procurement.vendorservice.repository.VendorDocumentRepository;
import com.procurement.vendorservice.repository.VendorRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Component
@RequiredArgsConstructor
@Slf4j
public class DataInitializer implements CommandLineRunner {

    private final VendorCategoryRepository categoryRepository;
    private final VendorRepository vendorRepository;
    private final VendorDocumentRepository documentRepository;

    @Override
    public void run(String... args) {
        initCategories();
        initVendors();
    }

    // ─── Categories ───────────────────────────────────────────────────────────

    private void initCategories() {
        if (categoryRepository.count() == 0) {
            createCategory(1L, "IT",           "Information Technology products and services");
            createCategory(2L, "Construction", "Construction materials and services");
            createCategory(3L, "Stationery",   "Office supplies and stationery");
            createCategory(4L, "Electronics",  "Electronic devices and components");
            createCategory(5L, "Furniture",    "Office and home furniture");
            log.info("Vendor categories initialized");
        }
    }

    private void createCategory(Long id, String name, String description) {
        VendorCategory c = new VendorCategory();
        c.setCategoryId(id);
        c.setCategoryName(name);
        c.setDescription(description);
        categoryRepository.save(c);
    }

    // ─── Vendors ──────────────────────────────────────────────────────────────

    private void initVendors() {
        if (vendorRepository.count() == 0) {
            VendorCategory it           = categoryRepository.findById(1L).orElseThrow();
            VendorCategory construction = categoryRepository.findById(2L).orElseThrow();
            VendorCategory stationery   = categoryRepository.findById(3L).orElseThrow();
            VendorCategory electronics  = categoryRepository.findById(4L).orElseThrow();
            VendorCategory furniture    = categoryRepository.findById(5L).orElseThrow();

            // userId values must match the user IDs created in auth-service DataInitializer.
            // Auth-service creates users in order: admin(1), alice(2), bob(3), carol(4),
            // david(5), vendor1(6), vendor2(7), vendor3(8), vendor4(9), vendor5(10), eve(11).
            Vendor v1 = createVendor("TechSupply Corp",       "John Smith",    "vendor1@techsupply.com",   "+1-555-0301",
                    "123 Tech Park, Silicon Valley, CA", "TX-IT-001234",  it,           "Verified",  6L);
            Vendor v2 = createVendor("BuildRight Ltd",        "Maria Garcia",  "vendor2@buildright.com",   "+1-555-0302",
                    "456 Construction Ave, Denver, CO",  "TX-CON-005678", construction, "Verified",  7L);
            Vendor v3 = createVendor("OfficeEssentials Inc",  "James Lee",     "vendor3@officeess.com",    "+1-555-0303",
                    "789 Office Blvd, Chicago, IL",      "TX-STA-009012", stationery,   "Verified",  8L);
            Vendor v4 = createVendor("ElectroWorld Co",       "Sarah Brown",   "vendor4@electroworld.com", "+1-555-0304",
                    "321 Electronics Dr, Austin, TX",    "TX-ELE-003456", electronics,  "Pending",   9L);
            Vendor v5 = createVendor("FurniturePlus LLC",     "Michael Davis", "vendor5@furnitureplus.com","+1-555-0305",
                    "654 Furniture Lane, Seattle, WA",   "TX-FUR-007890", furniture,    "Verified",  10L);

            // Documents for each vendor
            addDocuments(v1);
            addDocuments(v2);
            addDocuments(v3);
            addDocuments(v4);
            addDocuments(v5);

            log.info("Vendors and documents initialized");
        }
    }

    private Vendor createVendor(String companyName, String contactPerson, String email,
                                 String phone, String address, String taxId,
                                 VendorCategory category, String complianceStatus, Long userId) {
        Vendor v = new Vendor();
        v.setCompanyName(companyName);
        v.setContactPerson(contactPerson);
        v.setEmail(email);
        v.setPhoneNumber(phone);
        v.setAddress(address);
        v.setTaxId(taxId);
        v.setCategory(category);
        v.setComplianceStatus(complianceStatus);
        v.setUserId(userId);
        return vendorRepository.save(v);
    }

    private void addDocuments(Vendor vendor) {
        LocalDateTime now = LocalDateTime.now();
        LocalDate today   = LocalDate.now();

        // Business License
        VendorDocument license = new VendorDocument();
        license.setVendor(vendor);
        license.setDocumentType("LICENSE");
        license.setDocumentName("Business License");
        license.setFileUrl("https://docs.procurement.internal/" + vendor.getVendorId() + "/license.pdf");
        license.setIssueDate(today.minusYears(2));
        license.setExpiryDate(today.plusYears(1));
        license.setStatus("VALID");
        license.setUploadedAt(now.minusDays(60));
        license.setUploadedBy(vendor.getContactPerson());
        documentRepository.save(license);

        // Tax Certificate
        VendorDocument tax = new VendorDocument();
        tax.setVendor(vendor);
        tax.setDocumentType("TAX_CERT");
        tax.setDocumentName("Tax Clearance Certificate");
        tax.setFileUrl("https://docs.procurement.internal/" + vendor.getVendorId() + "/tax_cert.pdf");
        tax.setIssueDate(today.minusMonths(6));
        tax.setExpiryDate(today.plusMonths(6));
        tax.setStatus("VALID");
        tax.setUploadedAt(now.minusDays(55));
        tax.setUploadedBy(vendor.getContactPerson());
        documentRepository.save(tax);

        // Insurance
        VendorDocument insurance = new VendorDocument();
        insurance.setVendor(vendor);
        insurance.setDocumentType("INSURANCE");
        insurance.setDocumentName("Liability Insurance Policy");
        insurance.setFileUrl("https://docs.procurement.internal/" + vendor.getVendorId() + "/insurance.pdf");
        insurance.setIssueDate(today.minusYears(1));
        insurance.setExpiryDate(today.plusYears(1));
        insurance.setStatus("VALID");
        insurance.setUploadedAt(now.minusDays(50));
        insurance.setUploadedBy(vendor.getContactPerson());
        documentRepository.save(insurance);
    }
}
