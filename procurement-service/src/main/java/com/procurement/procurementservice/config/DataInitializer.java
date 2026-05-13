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

    private void initRequisitions() {
        // User IDs from auth-service seed:
        //   alice (officer)=2, bob (officer)=3, carol (manager)=4, david (manager)=5

        // PR-001: Converted to PO – laptops → PO 4 (Draft, awaiting vendor confirmation)
        PurchaseRequisition pr1 = buildRequisition(
                "PR-2025-001", 2L, "Engineering",
                "Laptops required for new engineering hires joining Q3 2025.",
                new BigDecimal("75000.00"), "CONVERTED_TO_PO", 2,
                LocalDateTime.now().minusDays(40));
        pr1.setItems(List.of(
                buildItem(pr1, "Dell XPS 15 Laptop", "16GB RAM, 512GB SSD, i7", 50, "unit", new BigDecimal("1400.00"), "IT"),
                buildItem(pr1, "Laptop Bag",          "15-inch padded laptop bag", 50, "unit", new BigDecimal("40.00"),   "IT")
        ));
        pr1.setApprovalHistory(List.of(
                buildApproval(pr1, 4L, "MANAGER", 1, "APPROVED", "Budget available, proceed.", LocalDateTime.now().minusDays(38)),
                buildApproval(pr1, 5L, "MANAGER", 2, "APPROVED", "Approved for Q3 procurement.", LocalDateTime.now().minusDays(36))
        ));
        requisitionRepository.save(pr1);

        // PR-002: Approved
        PurchaseRequisition pr2 = buildRequisition(
                "PR-2025-002", 3L, "Operations",
                "Office furniture for new headquarters workstations.",
                new BigDecimal("45000.00"), "APPROVED", 1,
                LocalDateTime.now().minusDays(25));
        pr2.setItems(List.of(
                buildItem(pr2, "Ergonomic Chair",   "Herman Miller Aeron",    30, "unit", new BigDecimal("900.00"),  "Furniture"),
                buildItem(pr2, "Standing Desk",     "Uplift V2 72-inch",      30, "unit", new BigDecimal("600.00"),  "Furniture")
        ));
        pr2.setApprovalHistory(List.of(
                buildApproval(pr2, 4L, "MANAGER", 1, "APPROVED", "Approved. New HQ setup priority.", LocalDateTime.now().minusDays(23))
        ));
        requisitionRepository.save(pr2);

        // PR-003: Pending Approval
        PurchaseRequisition pr3 = buildRequisition(
                "PR-2025-003", 2L, "IT",
                "Network equipment upgrade for improved office connectivity.",
                new BigDecimal("35000.00"), "PENDING_APPROVAL", 1,
                LocalDateTime.now().minusDays(5));
        pr3.setItems(List.of(
                buildItem(pr3, "Managed Switch",  "Cisco Catalyst 9200 24-port", 5,  "unit", new BigDecimal("2500.00"), "Electronics"),
                buildItem(pr3, "Wireless AP",     "Cisco Meraki MR46",           10, "unit", new BigDecimal("800.00"),  "Electronics"),
                buildItem(pr3, "Router",          "Fortinet FortiGate 100F",     2,  "unit", new BigDecimal("3500.00"), "Electronics")
        ));
        pr3.setApprovalHistory(List.of());
        requisitionRepository.save(pr3);

        // PR-004: Draft
        PurchaseRequisition pr4 = buildRequisition(
                "PR-2025-004", 3L, "Finance",
                "Annual stationery and office supplies for all departments.",
                new BigDecimal("12000.00"), "DRAFT", 0,
                LocalDateTime.now().minusDays(2));
        pr4.setItems(List.of(
                buildItem(pr4, "A4 Paper Ream",   "80gsm white paper",       200, "ream",  new BigDecimal("8.00"),   "Stationery"),
                buildItem(pr4, "Ballpoint Pens",  "Blue ink, box of 50",     20,  "box",   new BigDecimal("15.00"),  "Stationery"),
                buildItem(pr4, "File Folders",    "A4 manila folders",       500, "unit",  new BigDecimal("0.50"),   "Stationery"),
                buildItem(pr4, "Sticky Notes",    "3x3 inch, assorted",      100, "pack",  new BigDecimal("3.00"),   "Stationery")
        ));
        pr4.setApprovalHistory(List.of());
        requisitionRepository.save(pr4);

        // PR-005: Rejected
        PurchaseRequisition pr5 = buildRequisition(
                "PR-2025-005", 2L, "Marketing",
                "High-end video production equipment for marketing campaigns.",
                new BigDecimal("95000.00"), "REJECTED", 1,
                LocalDateTime.now().minusDays(15));
        pr5.setItems(List.of(
                buildItem(pr5, "4K Camera",       "Sony FX6 Cinema Camera",  3, "unit", new BigDecimal("6000.00"),  "Electronics"),
                buildItem(pr5, "Lighting Kit",    "Professional LED studio", 5, "unit", new BigDecimal("2000.00"),  "Electronics"),
                buildItem(pr5, "Editing Workstation", "Mac Pro M2 Ultra",    3, "unit", new BigDecimal("8000.00"),  "IT")
        ));
        pr5.setApprovalHistory(List.of(
                buildApproval(pr5, 4L, "MANAGER", 1, "REJECTED",
                        "Budget exceeds current fiscal allocation. Resubmit in Q4.",
                        LocalDateTime.now().minusDays(13))
        ));
        requisitionRepository.save(pr5);

        log.info("Purchase Requisitions initialized");
    }

    private PurchaseRequisition buildRequisition(String number, Long requesterId, String department,
                                                  String justification, BigDecimal budget,
                                                  String status, Integer approvalLevel,
                                                  LocalDateTime createdAt) {
        PurchaseRequisition pr = new PurchaseRequisition();
        pr.setRequisitionNumber(number);
        pr.setRequesterId(requesterId);
        pr.setDepartment(department);
        pr.setJustification(justification);
        pr.setEstimatedBudget(budget);
        pr.setStatus(status);
        pr.setCurrentApprovalLevel(approvalLevel);
        pr.setCreatedAt(createdAt);
        pr.setUpdatedAt(createdAt.plusDays(2));
        return pr;
    }

    private RequisitionItem buildItem(PurchaseRequisition pr, String name, String description,
                                       Integer qty, String unit, BigDecimal unitPrice, String category) {
        RequisitionItem item = new RequisitionItem();
        item.setRequisition(pr);
        item.setItemName(name);
        item.setDescription(description);
        item.setQuantity(qty);
        item.setUnit(unit);
        item.setEstimatedUnitPrice(unitPrice);
        item.setCategory(category);
        return item;
    }

    private ApprovalHistory buildApproval(PurchaseRequisition pr, Long approverId, String approverRole,
                                           Integer level, String decision, String comments,
                                           LocalDateTime approvedAt) {
        ApprovalHistory ah = new ApprovalHistory();
        ah.setRequisition(pr);
        ah.setApproverId(approverId);
        ah.setApproverRole(approverRole);
        ah.setApprovalLevel(level);
        ah.setDecision(decision);
        ah.setComments(comments);
        ah.setApprovedAt(approvedAt);
        return ah;
    }

    // ─── Purchase Orders ──────────────────────────────────────────────────────

    private void initPurchaseOrders() {
        // RFQ IDs from rfq-bidding-service seed: rfq4 (Awarded Construction) = 4
        // Vendor IDs: BuildRight=2, OfficeEssentials=3
        // User IDs: alice(officer)=2, carol(manager)=4, admin=1

        LocalDate today = LocalDate.now();

        // PO-001: Closed – Server Room Renovation fully delivered and invoiced
        // RFQ 4 (Awarded) → Vendor 2 (BuildRight) → delivery DELIVERED → invoice PAID
        PurchaseOrder po1 = new PurchaseOrder();
        po1.setRfqId(4L);
        po1.setVendorId(2L);
        po1.setTotalAmount(new BigDecimal("115000.00"));
        po1.setManagerId(4L);
        po1.setStatus("Closed");
        po1.setIssueDate(today.minusDays(55));
        po1.setExpectedDeliveryDate(today.minusDays(10));
        po1.setApprovedBy(4L);
        po1.setApprovalDate(today.minusDays(54));
        po1.setCreatedBy(2L);
        purchaseOrderRepository.save(po1);

        // PO-002: Dispatched – current stationery supply order
        // RFQ 3 (Closed, Accepted bid from vendor 3) → Vendor 3 (OfficeEssentials)
        PurchaseOrder po2 = new PurchaseOrder();
        po2.setRfqId(3L);
        po2.setVendorId(3L);
        po2.setTotalAmount(new BigDecimal("11200.00"));
        po2.setManagerId(4L);
        po2.setStatus("Dispatched");
        po2.setIssueDate(today.minusDays(15));
        po2.setExpectedDeliveryDate(today.plusDays(5));
        po2.setApprovedBy(4L);
        po2.setApprovalDate(today.minusDays(14));
        po2.setCreatedBy(3L);
        purchaseOrderRepository.save(po2);

        // PO-003: Pending Approval – Furniture
        // RFQ 2 (Open, bid from vendor 5) → Vendor 5 (FurniturePlus)
        PurchaseOrder po3 = new PurchaseOrder();
        po3.setRfqId(2L);
        po3.setVendorId(5L);
        po3.setTotalAmount(new BigDecimal("42000.00"));
        po3.setManagerId(5L);
        po3.setStatus("Pending Approval");
        po3.setIssueDate(today.minusDays(3));
        po3.setExpectedDeliveryDate(today.plusDays(25));
        po3.setCreatedBy(2L);
        purchaseOrderRepository.save(po3);

        // PO-004: Approved – Laptops (PR-2025-001 converted, vendor confirmed)
        // RFQ 1 (Open, bid from vendor 1) → Vendor 1 (TechSupply)
        PurchaseOrder po4 = new PurchaseOrder();
        po4.setRfqId(1L);
        po4.setVendorId(1L);
        po4.setTotalAmount(new BigDecimal("72000.00"));
        po4.setManagerId(4L);
        po4.setStatus("Approved");
        po4.setIssueDate(today.minusDays(5));
        po4.setExpectedDeliveryDate(today.plusDays(14));
        po4.setApprovedBy(4L);
        po4.setApprovalDate(today.minusDays(4));
        po4.setCreatedBy(2L);
        purchaseOrderRepository.save(po4);

        // PO-005: Closed – previous stationery contract (older RFQ 6)
        // Separate from PO 2 — this was last year's stationery order, now closed with dispute history
        PurchaseOrder po5 = new PurchaseOrder();
        po5.setRfqId(6L);
        po5.setVendorId(3L);
        po5.setTotalAmount(new BigDecimal("10800.00"));
        po5.setManagerId(4L);
        po5.setStatus("Closed");
        po5.setIssueDate(today.minusDays(60));
        po5.setExpectedDeliveryDate(today.minusDays(30));
        po5.setApprovedBy(4L);
        po5.setApprovalDate(today.minusDays(58));
        po5.setCreatedBy(3L);
        purchaseOrderRepository.save(po5);

        log.info("Purchase Orders initialized");
    }
}
