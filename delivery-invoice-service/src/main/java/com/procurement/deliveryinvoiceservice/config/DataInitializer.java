package com.procurement.deliveryinvoiceservice.config;

import com.procurement.deliveryinvoiceservice.entity.Delivery;
import com.procurement.deliveryinvoiceservice.entity.Dispute;
import com.procurement.deliveryinvoiceservice.entity.Invoice;
import com.procurement.deliveryinvoiceservice.entity.ThreeWayMatch;
import com.procurement.deliveryinvoiceservice.repository.DeliveryRepository;
import com.procurement.deliveryinvoiceservice.repository.DisputeRepository;
import com.procurement.deliveryinvoiceservice.repository.InvoiceRepository;
import com.procurement.deliveryinvoiceservice.repository.ThreeWayMatchRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Seed data — fully connected to procurement-service POs and auth-service users.
 *
 * PO → RFQ → Vendor mapping (from procurement-service DataInitializer):
 *   PO 1 → RFQ 4 (Server Room Renovation)  → Vendor 2 (BuildRight Ltd)        → $115,000 → Approved
 *   PO 2 → RFQ 3 (Stationery Supply)        → Vendor 3 (OfficeEssentials Inc)  → $11,200  → Dispatched
 *   PO 3 → RFQ 2 (Office Furniture)         → Vendor 5 (FurniturePlus LLC)     → $42,000  → Pending Approval
 *   PO 4 → RFQ 1 (Laptop Procurement)       → Vendor 1 (TechSupply Corp)       → $72,000  → Draft
 *   PO 5 → RFQ 3 (Stationery Supply)        → Vendor 3 (OfficeEssentials Inc)  → $10,800  → Closed
 *
 * User IDs: admin=1, alice(officer)=2, bob(officer)=3, carol(manager)=4, david(manager)=5
 *           vendor1(TechSupply)=6, vendor2(BuildRight)=7, vendor3(OfficeEssentials)=8,
 *           vendor4(ElectroWorld)=9, vendor5(FurniturePlus)=10, eve(auditor)=11
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class DataInitializer implements CommandLineRunner {

    private final DeliveryRepository deliveryRepository;
    private final InvoiceRepository invoiceRepository;
    private final DisputeRepository disputeRepository;
    private final ThreeWayMatchRepository threeWayMatchRepository;

    @Override
    public void run(String... args) {
        seedDeliveries();
        seedInvoices();
        seedDisputes();
        seedThreeWayMatches();
        log.info("DataInitializer: delivery-invoice-service seed data loaded.");
    }

    // ─── Deliveries ───────────────────────────────────────────────────────────

    private void seedDeliveries() {
        if (deliveryRepository.count() > 0) return;

        // Delivery 1 — PO 1 (Server Room Renovation, BuildRight, $115k) — Closed PO
        // Construction job completed on time; PO issued 55 days ago, delivered 10 days ago
        Delivery d1 = new Delivery();
        d1.setTenantId(1L);
        d1.setPoId(1L);
        d1.setDeliveryStatus("DELIVERED");
        d1.setExpectedDate(LocalDate.now().minusDays(10));
        d1.setActualDate(LocalDate.now().minusDays(10));
        d1.setQuantityDelivered(1);   // 1 = full project scope delivered
        d1.setDelayDays(0);
        d1.setQualityRemarks("Server room renovation completed to spec. Raised flooring, cooling, and cabling all signed off.");

        // Delivery 2 — PO 2 (Stationery, OfficeEssentials, $11,200) — in transit
        Delivery d2 = new Delivery();
        d2.setTenantId(1L);
        d2.setPoId(2L);
        d2.setDeliveryStatus("IN_TRANSIT");
        d2.setExpectedDate(LocalDate.now().plusDays(5));
        d2.setQuantityDelivered(0);
        d2.setDelayDays(0);
        d2.setQualityRemarks("Shipment dispatched from OfficeEssentials warehouse. Tracking: OE-2025-0892.");

        // Delivery 3 — PO 3 (Furniture, FurniturePlus, $42,000) — not yet scheduled
        Delivery d3 = new Delivery();
        d3.setTenantId(1L);
        d3.setPoId(3L);
        d3.setDeliveryStatus("PENDING");
        d3.setExpectedDate(LocalDate.now().plusDays(25));
        d3.setQuantityDelivered(0);
        d3.setDelayDays(0);
        d3.setQualityRemarks("Awaiting PO approval before delivery can be scheduled.");

        // Delivery 4 — PO 4 (Laptops, TechSupply, $72,000) — draft PO, not yet scheduled
        Delivery d4 = new Delivery();
        d4.setTenantId(1L);
        d4.setPoId(4L);
        d4.setDeliveryStatus("PENDING");
        d4.setExpectedDate(LocalDate.now().plusDays(14));
        d4.setQuantityDelivered(0);
        d4.setDelayDays(0);
        d4.setQualityRemarks("Delivery schedule pending PO finalisation.");

        // Delivery 5 — PO 5 (Stationery, OfficeEssentials, $10,800) — closed, had issues
        // PO was for stationery; 900 reams ordered, only 810 delivered (short by 90)
        Delivery d5 = new Delivery();
        d5.setTenantId(1L);
        d5.setPoId(5L);
        d5.setDeliveryStatus("DELIVERED");
        d5.setExpectedDate(LocalDate.now().minusDays(35));
        d5.setActualDate(LocalDate.now().minusDays(30));
        d5.setQuantityDelivered(810);  // 90 reams short of 900
        d5.setDelayDays(5);
        d5.setIssueNotes("90 reams of A4 paper short-delivered. Vendor cited stock shortage. Credit note requested.");
        d5.setQualityRemarks("Delivered items in good condition. Shortfall acknowledged by vendor rep.");

        deliveryRepository.save(d1);
        deliveryRepository.save(d2);
        deliveryRepository.save(d3);
        deliveryRepository.save(d4);
        deliveryRepository.save(d5);
        log.info("Seeded 5 deliveries.");
    }

    // ─── Invoices ─────────────────────────────────────────────────────────────

    private void seedInvoices() {
        if (invoiceRepository.count() > 0) return;

        // Invoice 1 — PO 1 (Server Room Renovation, $115,000) — paid, no discrepancy
        Invoice i1 = new Invoice();
        i1.setTenantId(1L);
        i1.setPoId(1L);
        i1.setVendorId(7L);  // BuildRight Ltd (vendor2)
        i1.setInvoiceAmount(new BigDecimal("115000.00"));
        i1.setStatus("PAID");
        i1.setInvoiceDate(LocalDate.now().minusDays(8));
        i1.setDiscrepancyFlag(false);

        // Invoice 2 — PO 2 (Stationery dispatch, $11,200) — pending, goods in transit
        Invoice i2 = new Invoice();
        i2.setTenantId(1L);
        i2.setPoId(2L);
        i2.setVendorId(8L);  // OfficeEssentials Inc (vendor3)
        i2.setInvoiceAmount(new BigDecimal("11200.00"));
        i2.setStatus("PENDING");
        i2.setInvoiceDate(LocalDate.now().minusDays(2));
        i2.setDiscrepancyFlag(false);

        // Invoice 3 — PO 3 (Furniture, $42,000) — under review, PO not yet approved
        Invoice i3 = new Invoice();
        i3.setTenantId(1L);
        i3.setPoId(3L);
        i3.setVendorId(10L);  // FurniturePlus LLC (vendor5)
        i3.setInvoiceAmount(new BigDecimal("42000.00"));
        i3.setStatus("UNDER_REVIEW");
        i3.setInvoiceDate(LocalDate.now().minusDays(1));
        i3.setDiscrepancyFlag(false);

        // Invoice 4 — PO 5 (Stationery closed, $10,800) — disputed due to short delivery
        // Vendor invoiced full $10,800 but only 810/900 reams delivered → should be $9,720
        Invoice i4 = new Invoice();
        i4.setTenantId(1L);
        i4.setPoId(5L);
        i4.setVendorId(8L);  // OfficeEssentials Inc (vendor3)
        i4.setInvoiceAmount(new BigDecimal("10800.00"));
        i4.setStatus("DISPUTED");
        i4.setInvoiceDate(LocalDate.now().minusDays(28));
        i4.setDiscrepancyFlag(true);
        i4.setDiscrepancyReason(
                "Vendor invoiced $10,800 for 900 reams but only 810 reams were delivered. " +
                "Expected invoice: $9,720. Difference: $1,080. Credit note or revised invoice required.");

        // Invoice 5 — PO 5 credit note / revised invoice after dispute resolution
        Invoice i5 = new Invoice();
        i5.setTenantId(1L);
        i5.setPoId(5L);
        i5.setVendorId(8L);  // OfficeEssentials Inc (vendor3)
        i5.setInvoiceAmount(new BigDecimal("9720.00"));
        i5.setStatus("PAID");
        i5.setInvoiceDate(LocalDate.now().minusDays(20));
        i5.setDiscrepancyFlag(false);

        invoiceRepository.save(i1);
        invoiceRepository.save(i2);
        invoiceRepository.save(i3);
        invoiceRepository.save(i4);
        invoiceRepository.save(i5);
        log.info("Seeded 5 invoices.");
    }

    // ─── Disputes ─────────────────────────────────────────────────────────────

    private void seedDisputes() {
        if (disputeRepository.count() > 0) return;

        // Dispute 1 — PO 5, quantity mismatch: officer raised against OfficeEssentials (vendor3, userId=8)
        // Status: RESOLVED — vendor issued credit note (invoice 5)
        Dispute disp1 = new Dispute();
        disp1.setTenantId(1L);
        disp1.setPoId(5L);
        disp1.setDeliveryId(5L);
        disp1.setInvoiceId(4L);
        disp1.setRaisedBy(3L);  // bob (officer) — createdBy on PO 5
        disp1.setRaisedByRole("PROCUREMENT_OFFICER");
        disp1.setDisputeType("QUANTITY_MISMATCH");
        disp1.setDescription(
                "PO #5 was for 900 reams of A4 paper at $12/ream ($10,800 total). " +
                "Only 810 reams were delivered but vendor invoiced the full $10,800. " +
                "Requesting revised invoice for 810 reams ($9,720).");
        disp1.setStatus("RESOLVED");
        disp1.setResolution(
                "Vendor OfficeEssentials Inc acknowledged the shortfall. " +
                "Revised invoice #5 issued for $9,720 (810 reams). Original invoice #4 voided.");
        disp1.setResolvedBy(4L);  // carol (manager)
        disp1.setRaisedAt(LocalDateTime.now().minusDays(27));
        disp1.setResolvedAt(LocalDateTime.now().minusDays(21));

        // Dispute 2 — PO 1, quality issue: officer raised against BuildRight (vendor2, userId=7)
        // Status: CLOSED — minor defect acknowledged, penalty waived
        Dispute disp2 = new Dispute();
        disp2.setTenantId(1L);
        disp2.setPoId(1L);
        disp2.setDeliveryId(1L);
        disp2.setInvoiceId(1L);
        disp2.setRaisedBy(2L);  // alice (officer) — createdBy on PO 1
        disp2.setRaisedByRole("PROCUREMENT_OFFICER");
        disp2.setDisputeType("QUALITY_ISSUE");
        disp2.setDescription(
                "Server room raised flooring tiles in section B show minor surface imperfections. " +
                "3 tiles need replacement before final sign-off. Requesting rectification within 5 business days.");
        disp2.setStatus("CLOSED");
        disp2.setResolution(
                "BuildRight Ltd dispatched a technician who replaced the 3 affected tiles within 3 days. " +
                "Final inspection passed. Invoice #1 approved for full payment.");
        disp2.setResolvedBy(4L);  // carol (manager)
        disp2.setRaisedAt(LocalDateTime.now().minusDays(9));
        disp2.setResolvedAt(LocalDateTime.now().minusDays(6));

        // Dispute 3 — PO 2, price mismatch: officer raised against OfficeEssentials (vendor3, userId=8)
        // Status: OPEN — invoice amount $11,200 but PO agreed $10,900 (vendor added freight surcharge)
        Dispute disp3 = new Dispute();
        disp3.setTenantId(1L);
        disp3.setPoId(2L);
        disp3.setDeliveryId(2L);
        disp3.setInvoiceId(2L);
        disp3.setRaisedBy(3L);  // bob (officer) — createdBy on PO 2
        disp3.setRaisedByRole("PROCUREMENT_OFFICER");
        disp3.setDisputeType("PRICE_MISMATCH");
        disp3.setDescription(
                "Invoice #2 for PO #2 shows $11,200 but the agreed PO amount is $11,200 — " +
                "however vendor has added a $300 freight surcharge not in the original contract. " +
                "Requesting removal of surcharge or formal contract amendment.");
        disp3.setStatus("OPEN");
        disp3.setRaisedAt(LocalDateTime.now().minusDays(1));

        // Dispute 4 — PO 5, delayed delivery: vendor raised to contest penalty clause
        // Status: UNDER_REVIEW — vendor claims delay was due to supplier issue
        Dispute disp4 = new Dispute();
        disp4.setTenantId(1L);
        disp4.setPoId(5L);
        disp4.setDeliveryId(5L);
        disp4.setInvoiceId(5L);
        disp4.setRaisedBy(8L);  // vendor3 user (OfficeEssentials) — vendor on PO 5
        disp4.setRaisedByRole("VENDOR");
        disp4.setDisputeType("DELAYED_DELIVERY");
        disp4.setDescription(
                "Delivery for PO #5 was 5 days late due to upstream paper mill supply disruption. " +
                "Requesting waiver of the 2% late delivery penalty ($216) as delay was force majeure.");
        disp4.setStatus("UNDER_REVIEW");
        disp4.setRaisedAt(LocalDateTime.now().minusDays(18));

        disputeRepository.save(disp1);
        disputeRepository.save(disp2);
        disputeRepository.save(disp3);
        disputeRepository.save(disp4);
        log.info("Seeded 4 disputes.");
    }

    // ─── Three-Way Matches ────────────────────────────────────────────────────

    private void seedThreeWayMatches() {
        if (threeWayMatchRepository.count() > 0) return;

        // Match 1 — PO 1 (Server Room, $115,000) — full match after dispute resolved
        ThreeWayMatch m1 = new ThreeWayMatch();
        m1.setTenantId(1L);
        m1.setPoId(1L);
        m1.setDeliveryId(1L);
        m1.setInvoiceId(1L);
        m1.setPoAmount(new BigDecimal("115000.00"));
        m1.setPoQuantity(1);
        m1.setInvoiceAmount(new BigDecimal("115000.00"));
        m1.setDeliveryQuantity(1);
        m1.setQuantityMatch(true);
        m1.setPriceMatch(true);
        m1.setStatus("MATCHED");
        m1.setValidatedAt(LocalDateTime.now().minusDays(5));

        // Match 2 — PO 2 (Stationery dispatch, $11,200) — pending, delivery not yet received
        ThreeWayMatch m2 = new ThreeWayMatch();
        m2.setTenantId(1L);
        m2.setPoId(2L);
        m2.setDeliveryId(2L);
        m2.setInvoiceId(2L);
        m2.setPoAmount(new BigDecimal("11200.00"));
        m2.setPoQuantity(1000);  // stationery bundle units
        m2.setInvoiceAmount(new BigDecimal("11200.00"));
        m2.setDeliveryQuantity(0);  // not yet delivered
        m2.setQuantityMatch(false);
        m2.setPriceMatch(true);
        m2.setStatus("PENDING");
        m2.setMismatchReason("Delivery in transit — quantity match cannot be confirmed until goods are received.");
        m2.setValidatedAt(LocalDateTime.now().minusDays(1));

        // Match 3 — PO 5 (Stationery closed) — mismatch on original invoice, resolved via credit note
        // Uses invoice 4 (disputed) to show the mismatch state
        ThreeWayMatch m3 = new ThreeWayMatch();
        m3.setTenantId(1L);
        m3.setPoId(5L);
        m3.setDeliveryId(5L);
        m3.setInvoiceId(4L);
        m3.setPoAmount(new BigDecimal("10800.00"));
        m3.setPoQuantity(900);
        m3.setInvoiceAmount(new BigDecimal("10800.00"));
        m3.setDeliveryQuantity(810);
        m3.setQuantityMatch(false);
        m3.setPriceMatch(false);
        m3.setStatus("MISMATCH");
        m3.setMismatchReason(
                "Only 810 of 900 reams delivered. Invoice charged full $10,800 instead of $9,720. " +
                "Dispute #1 raised and resolved — see revised invoice #5 ($9,720).");
        m3.setValidatedAt(LocalDateTime.now().minusDays(26));

        threeWayMatchRepository.save(m1);
        threeWayMatchRepository.save(m2);
        threeWayMatchRepository.save(m3);
        log.info("Seeded 3 three-way matches.");
    }
}
