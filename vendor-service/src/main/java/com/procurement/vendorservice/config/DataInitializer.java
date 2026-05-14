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
            // david(5), vendor1(6), vendor2(7), vendor3(8), vendor4(9), vendor5(10), eve(11), director(12).
            Vendor v1 = createVendor("TechSupply Corp",       "John Smith",    "vendor1@techsupply.com",   "+1-555-0301",
                    "123 Tech Park, Silicon Valley, CA 94025", "TX-IT-001234",  it,           "Verified",  6L);
            Vendor v2 = createVendor("BuildRight Ltd",        "Maria Garcia",  "vendor2@buildright.com",   "+1-555-0302",
                    "456 Construction Ave, Denver, CO 80202",  "TX-CON-005678", construction, "Verified",  7L);
            Vendor v3 = createVendor("OfficeEssentials Inc",  "James Lee",     "vendor3@officeess.com",    "+1-555-0303",
                    "789 Office Blvd, Chicago, IL 60601",      "TX-STA-009012", stationery,   "Verified",  8L);
            Vendor v4 = createVendor("ElectroWorld Co",       "Sarah Brown",   "vendor4@electroworld.com", "+1-555-0304",
                    "321 Electronics Dr, Austin, TX 78701",    "TX-ELE-003456", electronics,  "Pending",   9L);
            Vendor v5 = createVendor("FurniturePlus LLC",     "Michael Davis", "vendor5@furnitureplus.com","+1-555-0305",
                    "654 Furniture Lane, Seattle, WA 98101",   "TX-FUR-007890", furniture,    "Verified",  10L);

            addDocumentsTechSupply(v1);
            addDocumentsBuildRight(v2);
            addDocumentsOfficeEssentials(v3);
            addDocumentsElectroWorld(v4);
            addDocumentsFurniturePlus(v5);

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

    private VendorDocument doc(Vendor vendor, String type, String name, String urlSuffix,
                                LocalDate issued, LocalDate expires, String status,
                                LocalDateTime uploadedAt, String uploadedBy) {
        VendorDocument d = new VendorDocument();
        d.setVendor(vendor);
        d.setDocumentType(type);
        d.setDocumentName(name);
        d.setFileUrl("https://docs.procurement.internal/vendors/" + vendor.getVendorId() + "/" + urlSuffix);
        d.setIssueDate(issued);
        d.setExpiryDate(expires);
        d.setStatus(status);
        d.setUploadedAt(uploadedAt);
        d.setUploadedBy(uploadedBy);
        return documentRepository.save(d);
    }

    // ── TechSupply Corp – IT vendor, strong compliance record ─────────────────
    private void addDocumentsTechSupply(Vendor v) {
        LocalDate today = LocalDate.now();
        LocalDateTime now = LocalDateTime.now();
        // Business License – recently renewed, 2-year validity
        doc(v, "LICENSE",     "Business License",
                "business_license.pdf",
                today.minusMonths(3), today.plusMonths(21), "VALID",
                now.minusDays(90), "John Smith");
        // Tax Clearance Certificate – valid, expires in 8 months
        doc(v, "TAX_CERT",   "Tax Clearance Certificate",
                "tax_clearance.pdf",
                today.minusMonths(4), today.plusMonths(8), "VALID",
                now.minusDays(85), "John Smith");
        // Liability Insurance – 1-year policy
        doc(v, "INSURANCE",  "Commercial Liability Insurance",
                "liability_insurance.pdf",
                today.minusMonths(2), today.plusMonths(10), "VALID",
                now.minusDays(60), "John Smith");
        // ISO 9001 Quality Management Certificate
        doc(v, "ISO_CERT",   "ISO 9001:2015 Quality Management Certificate",
                "iso_9001_cert.pdf",
                today.minusYears(1), today.plusYears(2), "VALID",
                now.minusDays(365), "John Smith");
        // Cybersecurity Compliance Certificate – relevant for IT vendor
        doc(v, "COMPLIANCE", "Cybersecurity Compliance Certificate (SOC 2 Type II)",
                "soc2_compliance.pdf",
                today.minusMonths(6), today.plusMonths(18), "VALID",
                now.minusDays(180), "John Smith");
    }

    // ── BuildRight Ltd – Construction, highest quality score vendor ───────────
    private void addDocumentsBuildRight(Vendor v) {
        LocalDate today = LocalDate.now();
        LocalDateTime now = LocalDateTime.now();
        // Business License
        doc(v, "LICENSE",       "Business License",
                "business_license.pdf",
                today.minusYears(2), today.plusYears(1), "VALID",
                now.minusDays(120), "Maria Garcia");
        // Tax Clearance Certificate – expires soon (30 days)
        doc(v, "TAX_CERT",     "Tax Clearance Certificate",
                "tax_clearance.pdf",
                today.minusMonths(11), today.plusDays(30), "VALID",
                now.minusDays(330), "Maria Garcia");
        // Liability Insurance – multi-year policy
        doc(v, "INSURANCE",    "Commercial Liability Insurance ($5M Coverage)",
                "liability_insurance.pdf",
                today.minusYears(1), today.plusYears(2), "VALID",
                now.minusDays(365), "Maria Garcia");
        // ISO 9001 Quality Certificate – construction quality management
        doc(v, "ISO_CERT",     "ISO 9001:2015 Quality Management Certificate",
                "iso_9001.pdf",
                today.minusMonths(8), today.plusMonths(28), "VALID",
                now.minusDays(240), "Maria Garcia");
        // Environmental Compliance – required for construction
        doc(v, "ENVIRONMENTAL","ISO 14001:2015 Environmental Management Certificate",
                "iso_14001.pdf",
                today.minusMonths(5), today.plusMonths(31), "VALID",
                now.minusDays(150), "Maria Garcia");
        // Safety Certificate – OSHA construction compliance
        doc(v, "SAFETY",       "OSHA Construction Safety Certificate",
                "osha_safety_cert.pdf",
                today.minusMonths(10), today.plusMonths(14), "VALID",
                now.minusDays(300), "Maria Garcia");
    }

    // ── OfficeEssentials Inc – Stationery, medium performer with dispute history ─
    private void addDocumentsOfficeEssentials(Vendor v) {
        LocalDate today = LocalDate.now();
        LocalDateTime now = LocalDateTime.now();
        // Business License – valid
        doc(v, "LICENSE",    "Business License",
                "business_license.pdf",
                today.minusYears(3), today.plusMonths(9), "VALID",
                now.minusDays(200), "James Lee");
        // Tax Clearance Certificate – EXPIRED (slipped through annual renewal)
        doc(v, "TAX_CERT",  "Tax Clearance Certificate (EXPIRED)",
                "tax_clearance_expired.pdf",
                today.minusMonths(13), today.minusDays(30), "EXPIRED",
                now.minusDays(390), "James Lee");
        // New Tax Certificate – just uploaded to replace expired one
        doc(v, "TAX_CERT",  "Tax Clearance Certificate (Renewed)",
                "tax_clearance_2025.pdf",
                today.minusDays(5), today.plusMonths(12), "VALID",
                now.minusDays(5), "James Lee");
        // Liability Insurance
        doc(v, "INSURANCE", "Commercial Liability Insurance",
                "liability_insurance.pdf",
                today.minusMonths(7), today.plusMonths(5), "VALID",
                now.minusDays(210), "James Lee");
        // Quality Assurance Certificate
        doc(v, "ISO_CERT",  "ISO 9001:2015 Quality Management Certificate",
                "iso_9001.pdf",
                today.minusMonths(14), today.plusMonths(22), "VALID",
                now.minusDays(420), "James Lee");
    }

    // ── ElectroWorld Co – Electronics, Pending compliance verification ─────────
    private void addDocumentsElectroWorld(Vendor v) {
        LocalDate today = LocalDate.now();
        LocalDateTime now = LocalDateTime.now();
        // All documents for a Pending vendor are under verification
        doc(v, "LICENSE",    "Business License",
                "business_license.pdf",
                today.minusMonths(1), today.plusYears(2), "PENDING_VERIFICATION",
                now.minusDays(45), "Sarah Brown");
        doc(v, "TAX_CERT",  "Tax Clearance Certificate",
                "tax_clearance.pdf",
                today.minusMonths(2), today.plusMonths(10), "PENDING_VERIFICATION",
                now.minusDays(43), "Sarah Brown");
        doc(v, "INSURANCE", "Commercial Liability Insurance",
                "liability_insurance.pdf",
                today.minusMonths(1), today.plusMonths(11), "PENDING_VERIFICATION",
                now.minusDays(40), "Sarah Brown");
        // ISO 9001 – not yet submitted, under verification
        doc(v, "ISO_CERT",  "ISO 9001:2015 Quality Management Certificate",
                "iso_9001.pdf",
                today.minusMonths(3), today.plusYears(3), "PENDING_VERIFICATION",
                now.minusDays(38), "Sarah Brown");
    }

    // ── FurniturePlus LLC – Furniture, consistent high performer ─────────────
    private void addDocumentsFurniturePlus(Vendor v) {
        LocalDate today = LocalDate.now();
        LocalDateTime now = LocalDateTime.now();
        // Business License
        doc(v, "LICENSE",       "Business License",
                "business_license.pdf",
                today.minusYears(1), today.plusYears(2), "VALID",
                now.minusDays(365), "Michael Davis");
        // Tax Clearance Certificate
        doc(v, "TAX_CERT",     "Tax Clearance Certificate",
                "tax_clearance.pdf",
                today.minusMonths(5), today.plusMonths(7), "VALID",
                now.minusDays(150), "Michael Davis");
        // Liability Insurance
        doc(v, "INSURANCE",    "Commercial Liability Insurance",
                "liability_insurance.pdf",
                today.minusYears(1), today.plusYears(2), "VALID",
                now.minusDays(365), "Michael Davis");
        // ISO 9001 Quality Certificate
        doc(v, "ISO_CERT",     "ISO 9001:2015 Quality Management Certificate",
                "iso_9001.pdf",
                today.minusMonths(6), today.plusMonths(30), "VALID",
                now.minusDays(180), "Michael Davis");
        // Trade License – relevant for furniture import/distribution
        doc(v, "TRADE_LICENSE","Trade and Import License",
                "trade_license.pdf",
                today.minusMonths(8), today.plusMonths(16), "VALID",
                now.minusDays(240), "Michael Davis");
    }
}
