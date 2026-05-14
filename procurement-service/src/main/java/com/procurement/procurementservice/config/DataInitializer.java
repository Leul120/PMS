package com.procurement.procurementservice.config;

import com.procurement.procurementservice.entity.ApprovalHistory;
import com.procurement.procurementservice.entity.PurchaseOrder;
import com.procurement.procurementservice.entity.PurchaseRequisition;
import com.procurement.procurementservice.entity.RequisitionItem;
import com.procurement.procurementservice.repository.PurchaseOrderRepository;
import com.procurement.procurementservice.repository.PurchaseRequisitionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Component
@RequiredArgsConstructor
@Slf4j
public class DataInitializer implements CommandLineRunner {

    private final PurchaseRequisitionRepository requisitionRepository;
    private final PurchaseOrderRepository purchaseOrderRepository;

    @Override
    public void run(String... args) {
        if (requisitionRepository.count() == 0) {
            initRequisitions();
        }
        if (purchaseOrderRepository.count() == 0) {
            initPurchaseOrders();
        }
    }

    // ─── Purchase Requisitions ────────────────────────────────────────────────
    // User IDs from auth-service seed:
    //   alice (officer)=2, bob (officer)=3, carol (manager)=4, david (manager)=5

    private void initRequisitions() {

        // ── PR-001: CONVERTED_TO_PO – Engineering laptops → PO #4 (Approved) ─
        PurchaseRequisition pr1 = pr(
                "PR-2025-001", 2L, "Engineering",
                "50 high-performance laptops required for new engineering hires joining Q3 2025. " +
                "Minimum specs per IT policy: 16GB RAM, 512GB SSD, Intel i7 or equivalent.",
                new BigDecimal("75000.00"), "CONVERTED_TO_PO", 2,
                LocalDateTime.now().minusDays(40));
        pr1.setItems(List.of(
                item(pr1, "Dell XPS 15 Laptop",   "16GB DDR5 RAM, 512GB NVMe SSD, Intel i7-13th Gen, OLED display", 50, "unit", new BigDecimal("1400.00"), "IT"),
                item(pr1, "Laptop Bag",             "15-inch padded laptop carry bag with accessories pocket",         50, "unit", new BigDecimal("40.00"),   "IT")
        ));
        pr1.setApprovalHistory(List.of(
                approval(pr1, 4L, "MANAGER", 1, "APPROVED", "Budget confirmed available in IT capex. Proceed to RFQ.", LocalDateTime.now().minusDays(38)),
                approval(pr1, 5L, "MANAGER", 2, "APPROVED", "Approved for Q3 procurement cycle. Urgency noted.", LocalDateTime.now().minusDays(36))
        ));
        requisitionRepository.save(pr1);

        // ── PR-002: APPROVED – New HQ office furniture → PO #3 (Pending Approval) ─
        PurchaseRequisition pr2 = pr(
                "PR-2025-002", 3L, "Operations",
                "Ergonomic office furniture for 30 workstations in the new headquarters building. " +
                "Health and safety requirement — current stock critically low and out of stock.",
                new BigDecimal("45000.00"), "APPROVED", 1,
                LocalDateTime.now().minusDays(25));
        pr2.setItems(List.of(
                item(pr2, "Ergonomic Chair",  "Herman Miller Aeron, size B, fully adjustable lumbar support", 30, "unit", new BigDecimal("900.00"),  "Furniture"),
                item(pr2, "Standing Desk",    "Uplift V2 Commercial 72x30 inch electric sit-stand desk",       30, "unit", new BigDecimal("600.00"),  "Furniture")
        ));
        pr2.setApprovalHistory(List.of(
                approval(pr2, 4L, "MANAGER", 1, "APPROVED", "Approved. New HQ setup is a priority. Proceed to vendor sourcing.", LocalDateTime.now().minusDays(23))
        ));
        requisitionRepository.save(pr2);

        // ── PR-003: PENDING_APPROVAL – IT network equipment upgrade ─────────────
        PurchaseRequisition pr3 = pr(
                "PR-2025-003", 2L, "IT",
                "Network infrastructure upgrade for the main office — current switches and APs are " +
                "end-of-life (EOL) and causing connectivity issues affecting all staff.",
                new BigDecimal("35000.00"), "PENDING_APPROVAL", 0,
                LocalDateTime.now().minusDays(5));
        pr3.setItems(List.of(
                item(pr3, "Managed Switch 24-Port",  "Cisco Catalyst 9200 24-port enterprise managed switch",   5,  "unit", new BigDecimal("2500.00"), "Electronics"),
                item(pr3, "Wireless Access Point",   "Cisco Meraki MR57 Wi-Fi 6E enterprise access point",      10, "unit", new BigDecimal("800.00"),  "Electronics"),
                item(pr3, "Next-Gen Firewall",        "Fortinet FortiGate 200F next-generation firewall",        2,  "unit", new BigDecimal("3500.00"), "Electronics")
        ));
        pr3.setApprovalHistory(List.of());
        requisitionRepository.save(pr3);

        // ── PR-004: DRAFT – Annual stationery and office supplies ─────────────
        PurchaseRequisition pr4 = pr(
                "PR-2025-004", 3L, "Finance",
                "Annual stationery and office supplies replenishment for all departments. " +
                "Items are consumables required for daily operations.",
                new BigDecimal("12000.00"), "DRAFT", 0,
                LocalDateTime.now().minusDays(2));
        pr4.setItems(List.of(
                item(pr4, "A4 Paper Ream",      "HP A4 80gsm white paper, 500 sheets per ream",         200, "ream", new BigDecimal("8.00"),   "Stationery"),
                item(pr4, "Ballpoint Pens",      "Bic Cristal blue ink ballpoint pens, box of 50",       20,  "box",  new BigDecimal("15.00"),  "Stationery"),
                item(pr4, "File Folders",         "Avery A4 manila file folders, box of 100",             500, "unit", new BigDecimal("0.50"),   "Stationery"),
                item(pr4, "Sticky Notes",         "3M Post-it 3x3 inch, assorted colours, 12-pad pack",  100, "pack", new BigDecimal("3.00"),   "Stationery")
        ));
        pr4.setApprovalHistory(List.of());
        requisitionRepository.save(pr4);

        // ── PR-005: REJECTED – Marketing video production equipment ──────────
        PurchaseRequisition pr5 = pr(
                "PR-2025-005", 2L, "Marketing",
                "High-end video production equipment for in-house marketing campaign production. " +
                "Would eliminate outsourcing costs of $40,000 annually.",
                new BigDecimal("95000.00"), "REJECTED", 1,
                LocalDateTime.now().minusDays(15));
        pr5.setItems(List.of(
                item(pr5, "4K Cinema Camera",       "Sony FX6 Full-Frame Cinema Camera",      3, "unit", new BigDecimal("6000.00"),  "Electronics"),
                item(pr5, "Professional LED Lights", "Aputure 600d Pro LED studio lighting",  5, "unit", new BigDecimal("2000.00"),  "Electronics"),
                item(pr5, "Editing Workstation",     "Apple Mac Pro M2 Ultra, 192GB RAM",     3, "unit", new BigDecimal("8000.00"),  "IT")
        ));
        pr5.setApprovalHistory(List.of(
                approval(pr5, 4L, "MANAGER", 1, "REJECTED",
                        "Budget exceeds current fiscal year allocation by $85,000. " +
                        "Marketing capex is frozen until Q4. Resubmit with revised scope or in Q4.",
                        LocalDateTime.now().minusDays(13))
        ));
        requisitionRepository.save(pr5);

        // ── PR-006: APPROVED – IT security software licensing ────────────────
        // Linked to RFQ 7 — alice submitted, carol approved
        PurchaseRequisition pr6 = pr(
                "PR-2025-006", 2L, "IT",
                "Annual endpoint security software licensing for 200 endpoints. " +
                "Current antivirus solution is end-of-life. Cybersecurity audit flagged this as P1 risk.",
                new BigDecimal("28000.00"), "APPROVED", 1,
                LocalDateTime.now().minusDays(7));
        pr6.setItems(List.of(
                item(pr6, "EDR/XDR Endpoint License",   "CrowdStrike Falcon Complete — 200 endpoint annual license",  200, "license", new BigDecimal("130.00"), "IT"),
                item(pr6, "SOC Monitoring Service",      "24/7 managed SOC threat monitoring, annual subscription",    1,   "service", new BigDecimal("2000.00"), "IT")
        ));
        pr6.setApprovalHistory(List.of(
                approval(pr6, 4L, "MANAGER", 1, "APPROVED",
                        "Approved — cybersecurity is a critical need. Proceed to RFQ immediately. " +
                        "ISO 27001 vendor certification mandatory.",
                        LocalDateTime.now().minusDays(5))
        ));
        requisitionRepository.save(pr6);

        // ── PR-007: PENDING_APPROVAL – Conference room AV system ─────────────
        PurchaseRequisition pr7 = pr(
                "PR-2025-007", 3L, "Operations",
                "Conference room audio-visual system upgrade for the main boardroom and 2 meeting rooms. " +
                "Existing projector is 8 years old and failing. Client-facing meetings impacted.",
                new BigDecimal("22000.00"), "PENDING_APPROVAL", 0,
                LocalDateTime.now().minusDays(1));
        pr7.setItems(List.of(
                item(pr7, "4K Laser Projector",       "Epson EB-PU2010W 10,000 lumen 4K laser projector",  1, "unit", new BigDecimal("8000.00"), "Electronics"),
                item(pr7, "Interactive Display Panel", "Samsung 75-inch 4K interactive flat panel",         2, "unit", new BigDecimal("4500.00"), "Electronics"),
                item(pr7, "Conference Speaker System", "Bose Professional WorkSpace wireless ceiling array", 3, "unit", new BigDecimal("1000.00"), "Electronics")
        ));
        pr7.setApprovalHistory(List.of());
        requisitionRepository.save(pr7);

        log.info("Purchase Requisitions initialized: 7 records");
    }

    private PurchaseRequisition pr(String number, Long requesterId, String department,
                                    String justification, BigDecimal budget,
                                    String status, Integer approvalLevel,
                                    LocalDateTime createdAt) {
        PurchaseRequisition p = new PurchaseRequisition();
        p.setRequisitionNumber(number);
        p.setRequesterId(requesterId);
        p.setDepartment(department);
        p.setJustification(justification);
        p.setEstimatedBudget(budget);
        p.setStatus(status);
        p.setCurrentApprovalLevel(approvalLevel);
        p.setCreatedAt(createdAt);
        p.setUpdatedAt(createdAt.plusDays(2));
        return p;
    }

    private RequisitionItem item(PurchaseRequisition pr, String name, String description,
                                  Integer qty, String unit, BigDecimal unitPrice, String category) {
        RequisitionItem i = new RequisitionItem();
        i.setRequisition(pr);
        i.setItemName(name);
        i.setDescription(description);
        i.setQuantity(qty);
        i.setUnit(unit);
        i.setEstimatedUnitPrice(unitPrice);
        i.setCategory(category);
        return i;
    }

    private ApprovalHistory approval(PurchaseRequisition pr, Long approverId, String role,
                                      Integer level, String decision, String comments,
                                      LocalDateTime approvedAt) {
        ApprovalHistory a = new ApprovalHistory();
        a.setRequisition(pr);
        a.setApproverId(approverId);
        a.setApproverRole(role);
        a.setApprovalLevel(level);
        a.setDecision(decision);
        a.setComments(comments);
        a.setApprovedAt(approvedAt);
        return a;
    }

    // ─── Purchase Orders ──────────────────────────────────────────────────────
    // Vendor IDs (from vendor-service seed): TechSupply=1, BuildRight=2,
    //   OfficeEssentials=3, ElectroWorld=4, FurniturePlus=5
    // User IDs: alice(officer)=2, bob(officer)=3, carol(manager)=4, david(manager)=5

    private void initPurchaseOrders() {
        LocalDate today = LocalDate.now();

        // ── PO-001: Closed – Server Room Renovation (BuildRight, $115,000) ─────
        // Full lifecycle: Approved → Delivered → Invoice Paid → Three-way match → Closed
        PurchaseOrder po1 = new PurchaseOrder();
        po1.setRfqId(4L);           // RFQ 4: Server Room Renovation (Awarded)
        po1.setVendorId(2L);        // BuildRight Ltd
        po1.setTotalAmount(new BigDecimal("115000.00"));
        po1.setManagerId(4L);       // carol (manager)
        po1.setStatus("Closed");
        po1.setIssueDate(today.minusDays(55));
        po1.setExpectedDeliveryDate(today.minusDays(10));
        po1.setApprovedBy(4L);      // carol approved
        po1.setApprovalDate(today.minusDays(54));
        po1.setCreatedBy(2L);       // alice created
        purchaseOrderRepository.save(po1);

        // ── PO-002: Dispatched – Annual Stationery Supply (OfficeEssentials, $11,200) ─
        // In transit — delivery expected in 5 days, invoice submitted but under dispute
        PurchaseOrder po2 = new PurchaseOrder();
        po2.setRfqId(3L);           // RFQ 3: Annual Stationery Supply (Closed)
        po2.setVendorId(3L);        // OfficeEssentials Inc
        po2.setTotalAmount(new BigDecimal("11200.00"));
        po2.setManagerId(4L);       // carol (manager)
        po2.setStatus("Dispatched");
        po2.setIssueDate(today.minusDays(15));
        po2.setExpectedDeliveryDate(today.plusDays(5));
        po2.setApprovedBy(4L);      // carol approved
        po2.setApprovalDate(today.minusDays(14));
        po2.setCreatedBy(3L);       // bob created
        purchaseOrderRepository.save(po2);

        // ── PO-003: Pending Approval – Office Furniture Refresh (FurniturePlus, $42,000) ─
        // Awaiting david (manager) approval — standing desks are out of stock
        PurchaseOrder po3 = new PurchaseOrder();
        po3.setRfqId(2L);           // RFQ 2: Office Furniture Refresh (Open)
        po3.setVendorId(5L);        // FurniturePlus LLC
        po3.setTotalAmount(new BigDecimal("42000.00"));
        po3.setManagerId(5L);       // david (manager) — assigned for approval
        po3.setStatus("Pending Approval");
        po3.setIssueDate(today.minusDays(3));
        po3.setExpectedDeliveryDate(today.plusDays(25));
        po3.setCreatedBy(2L);       // alice created
        purchaseOrderRepository.save(po3);

        // ── PO-004: Approved – Laptop Procurement (TechSupply, $72,000) ────────
        // Approved and awaiting delivery — PR-2025-001 converted to this PO
        PurchaseOrder po4 = new PurchaseOrder();
        po4.setRfqId(1L);           // RFQ 1: Laptop Procurement (Open)
        po4.setVendorId(1L);        // TechSupply Corp
        po4.setTotalAmount(new BigDecimal("72000.00"));
        po4.setManagerId(4L);       // carol (manager)
        po4.setStatus("Approved");
        po4.setIssueDate(today.minusDays(5));
        po4.setExpectedDeliveryDate(today.plusDays(14));
        po4.setApprovedBy(4L);      // carol approved
        po4.setApprovalDate(today.minusDays(4));
        po4.setCreatedBy(2L);       // alice created
        purchaseOrderRepository.save(po4);

        // ── PO-005: Closed – Stationery Supply Q1 2025 (OfficeEssentials, $10,800) ─
        // Fully closed after dispute resolution — 810/900 reams delivered, revised invoice paid
        PurchaseOrder po5 = new PurchaseOrder();
        po5.setRfqId(6L);           // RFQ 6: Stationery Supply Q1 2025 (Closed/Awarded)
        po5.setVendorId(3L);        // OfficeEssentials Inc
        po5.setTotalAmount(new BigDecimal("10800.00"));
        po5.setManagerId(4L);       // carol (manager)
        po5.setStatus("Closed");
        po5.setIssueDate(today.minusDays(60));
        po5.setExpectedDeliveryDate(today.minusDays(30));
        po5.setApprovedBy(4L);      // carol approved
        po5.setApprovalDate(today.minusDays(58));
        po5.setCreatedBy(3L);       // bob created
        purchaseOrderRepository.save(po5);

        // ── PO-006: Approved – Network Equipment Upgrade (ElectroWorld, $33,000) ─
        // New PO raised after PR-2025-003 approved and RFQ 5 bidding closed
        // Awaiting vendor delivery — delivery expected in 14 days
        PurchaseOrder po6 = new PurchaseOrder();
        po6.setRfqId(5L);           // RFQ 5: Network Equipment Upgrade (Open, ElectroWorld leading)
        po6.setVendorId(4L);        // ElectroWorld Co
        po6.setTotalAmount(new BigDecimal("33000.00"));
        po6.setManagerId(5L);       // david (manager)
        po6.setStatus("Approved");
        po6.setIssueDate(today.minusDays(1));
        po6.setExpectedDeliveryDate(today.plusDays(14));
        po6.setApprovedBy(5L);      // david approved
        po6.setApprovalDate(today.minusDays(1));
        po6.setCreatedBy(3L);       // bob created (he raised RFQ 5)
        purchaseOrderRepository.save(po6);

        log.info("Purchase Orders initialized: 6 records");
    }
}
