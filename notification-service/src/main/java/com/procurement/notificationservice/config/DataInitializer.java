package com.procurement.notificationservice.config;

import com.procurement.notificationservice.entity.Notification;
import com.procurement.notificationservice.repository.NotificationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;

@Component
@RequiredArgsConstructor
@Slf4j
public class DataInitializer implements CommandLineRunner {

    private final NotificationRepository notificationRepository;

    @Override
    public void run(String... args) {
        if (notificationRepository.count() == 0) {
            initNotifications();
        }
    }

    private void initNotifications() {
        // User IDs from auth-service seed:
        //   admin=1, alice(officer)=2, bob(officer)=3, carol(manager)=4,
        //   david(manager)=5, vendor1=6, vendor2=7, vendor3=8, vendor4=9, vendor5=10, eve(auditor)=11
        // RFQ IDs: 1=Laptops, 2=Furniture, 3=Stationery, 4=ServerRoom, 5=Network
        // PO IDs:  1=Approved, 2=Dispatched, 3=PendingApproval, 4=Draft, 5=Closed

        LocalDateTime now = LocalDateTime.now();

        // ── Bid deadline reminders (for officers) ─────────────────────────────
        createNotification(2L, "IN_APP", "Bid Deadline Approaching",
                "RFQ 'Laptop Procurement Q3 2025' closes in 24 hours. Review submitted bids.",
                "SENT", "BID_DEADLINE", "1", now.minusHours(24), now.minusHours(24), null);

        createNotification(3L, "IN_APP", "Bid Deadline Approaching",
                "RFQ 'Network Equipment Upgrade' closes in 24 hours. 2 bids received.",
                "SENT", "BID_DEADLINE", "5", now.minusHours(10), now.minusHours(10), null);

        // ── Approval pending (for managers) ───────────────────────────────────
        createNotification(5L, "IN_APP", "Purchase Order Awaiting Approval",
                "PO #3 for Office Furniture (FurniturePlus LLC, $42,000) requires your approval.",
                "SENT", "APPROVAL_PENDING", "3", now.minusDays(3), now.minusDays(3), null);

        createNotification(5L, "IN_APP", "Purchase Requisition Pending Review",
                "PR-2025-003 (Network Equipment, $35,000) submitted by Alice Johnson awaits approval.",
                "SENT", "APPROVAL_PENDING", "PR-2025-003", now.minusDays(5), now.minusDays(5), null);

        // ── Delivery updates ──────────────────────────────────────────────────
        createNotification(2L, "IN_APP", "Order Dispatched",
                "PO #2 (Stationery Supply) has been dispatched by OfficeEssentials Inc. Expected delivery in 5 days.",
                "READ", "DELIVERY_UPDATE", "2", now.minusDays(15), now.minusDays(15), now.minusDays(14));

        createNotification(4L, "IN_APP", "Delivery Confirmed",
                "PO #5 (Stationery Supply) has been delivered and closed successfully.",
                "READ", "DELIVERY_UPDATE", "5", now.minusDays(30), now.minusDays(30), now.minusDays(29));

        // ── Vendor alerts ─────────────────────────────────────────────────────
        createNotification(1L, "IN_APP", "New Vendor Registration",
                "ElectroWorld Co has registered and is pending compliance verification.",
                "READ", "VENDOR_ALERT", "4", now.minusDays(45), now.minusDays(45), now.minusDays(44));

        createNotification(1L, "IN_APP", "Vendor Document Expiring Soon",
                "TechSupply Corp's Tax Clearance Certificate expires in 30 days. Please follow up.",
                "SENT", "VENDOR_ALERT", "1", now.minusDays(1), now.minusDays(1), null);

        // ── Vendor-side notifications ─────────────────────────────────────────
        createNotification(6L, "IN_APP", "New RFQ Available",
                "A new RFQ 'Laptop Procurement Q3 2025' matching your category is open for bidding.",
                "READ", "BID_DEADLINE", "1", now.minusDays(10), now.minusDays(10), now.minusDays(9));

        createNotification(7L, "IN_APP", "Bid Awarded",
                "Congratulations! Your bid for 'Server Room Renovation' (RFQ #4) has been awarded.",
                "READ", "DELIVERY_UPDATE", "4", now.minusDays(28), now.minusDays(28), now.minusDays(27));

        createNotification(8L, "IN_APP", "Bid Accepted",
                "Your bid for 'Annual Stationery Supply Contract' (RFQ #3) has been accepted.",
                "READ", "BID_DEADLINE", "3", now.minusDays(18), now.minusDays(18), now.minusDays(17));

        createNotification(9L, "IN_APP", "New RFQ Available",
                "A new RFQ 'Network Equipment Upgrade' matching your category is open for bidding.",
                "SENT", "BID_DEADLINE", "5", now.minusDays(2), now.minusDays(2), null);

        // ── Dispute notifications ─────────────────────────────────────────────
        createNotification(3L, "IN_APP", "Dispute Raised – PO #5",
                "Quantity mismatch dispute raised on PO #5 (Stationery, OfficeEssentials). " +
                "810 of 900 reams delivered but full $10,800 invoiced. Awaiting manager review.",
                "READ", "DELIVERY_UPDATE", "5", now.minusDays(27), now.minusDays(27), now.minusDays(26));

        createNotification(4L, "IN_APP", "Dispute Resolved – PO #5",
                "Dispute on PO #5 resolved. OfficeEssentials Inc issued revised invoice for $9,720 (810 reams). " +
                "Original invoice voided.",
                "READ", "DELIVERY_UPDATE", "5", now.minusDays(21), now.minusDays(21), now.minusDays(20));

        createNotification(8L, "IN_APP", "Dispute Filed Against Your Invoice",
                "A quantity mismatch dispute has been filed on your invoice for PO #5. " +
                "810 reams delivered vs 900 ordered. Please issue a revised invoice for $9,720.",
                "READ", "DELIVERY_UPDATE", "5", now.minusDays(27), now.minusDays(27), now.minusDays(25));

        createNotification(3L, "IN_APP", "Price Dispute Opened – PO #2",
                "Price mismatch dispute opened on PO #2 (Stationery, OfficeEssentials). " +
                "Vendor added $300 freight surcharge not in original contract.",
                "SENT", "DELIVERY_UPDATE", "2", now.minusDays(1), now.minusDays(1), null);

        // ── Three-way match alerts ────────────────────────────────────────────
        createNotification(2L, "IN_APP", "Three-Way Match Completed – PO #1",
                "PO #1 (Server Room Renovation) three-way match validated. PO, delivery, and invoice all match. " +
                "Invoice #1 ($115,000) approved for payment.",
                "READ", "DELIVERY_UPDATE", "1", now.minusDays(5), now.minusDays(5), now.minusDays(4));

        createNotification(4L, "IN_APP", "Three-Way Match Mismatch – PO #5",
                "Three-way match for PO #5 shows quantity mismatch: 810 delivered vs 900 ordered. " +
                "Invoice #4 flagged. Dispute #1 raised.",
                "READ", "DELIVERY_UPDATE", "5", now.minusDays(26), now.minusDays(26), now.minusDays(25));

        // ── Low inventory alerts ──────────────────────────────────────────────
        createNotification(2L, "IN_APP", "Critical Stock Alert – Laptops",
                "IT-001 (Laptop - Dell XPS 15) is critically low: 2 units remaining (min: 10). " +
                "PR-2025-001 raised, approved, and converted to PO #4 (Approved, delivery in 14 days).",
                "READ", "VENDOR_ALERT", null, now.minusDays(40), now.minusDays(40), now.minusDays(39));

        createNotification(2L, "IN_APP", "Critical Stock Alert – Standing Desks",
                "FN-002 (Standing Desk) is out of stock. PR-2025-002 raised for 30 units. " +
                "PO #3 pending manager approval.",
                "SENT", "VENDOR_ALERT", null, now.minusDays(3), now.minusDays(3), null);

        // ── Auditor notifications ─────────────────────────────────────────────
        createNotification(11L, "IN_APP", "Monthly Compliance Report Ready",
                "The vendor compliance report for April 2025 is ready for review.",
                "SENT", "VENDOR_ALERT", null, now.minusDays(10), now.minusDays(10), null);

        createNotification(11L, "IN_APP", "Dispute Activity Summary",
                "4 disputes recorded this period: 2 resolved/closed, 1 open, 1 under review. " +
                "Total disputed value: $11,380. Review audit trail for details.",
                "SENT", "VENDOR_ALERT", null, now.minusDays(5), now.minusDays(5), null);

        // ── Email notifications ────────────────────────────────────────────────
        createNotification(2L, "EMAIL", "RFQ Closed – Action Required",
                "RFQ 'Annual Stationery Supply Contract' has closed. Please evaluate bids and select a winner.",
                "SENT", "BID_DEADLINE", "3", now.minusDays(5), now.minusDays(5), null);

        createNotification(4L, "EMAIL", "High-Value PO Approved – PO #1",
                "Purchase Order #1 for Server Room Renovation (BuildRight Ltd, $115,000) has been approved. " +
                "Vendor has been notified to proceed.",
                "READ", "APPROVAL_PENDING", "1", now.minusDays(54), now.minusDays(54), now.minusDays(53));

        createNotification(4L, "EMAIL", "PO #3 Awaiting Your Approval – Urgent",
                "PO #3 for Office Furniture (FurniturePlus LLC, $42,000) is pending your approval. " +
                "Standing desks are out of stock.",
                "SENT", "APPROVAL_PENDING", "3", now.minusDays(3), now.minusDays(3), null);

        createNotification(4L, "EMAIL", "PO #4 Approved – Laptops",
                "Purchase Order #4 for Laptop Procurement (TechSupply Corp, $72,000) has been approved. " +
                "Expected delivery in 14 days.",
                "READ", "APPROVAL_PENDING", "4", now.minusDays(4), now.minusDays(4), now.minusDays(3));

        createNotification(8L, "EMAIL", "Revised Invoice Required – PO #5",
                "Please issue a revised invoice for PO #5 reflecting 810 reams at $12/ream = $9,720. " +
                "Original invoice has been disputed and voided.",
                "READ", "DELIVERY_UPDATE", "5", now.minusDays(24), now.minusDays(24), now.minusDays(22));

        log.info("Notifications initialized");
    }

    private void createNotification(Long userId, String type, String title, String message,
                                     String status, String category, String relatedEntityId,
                                     LocalDateTime createdAt, LocalDateTime sentAt, LocalDateTime readAt) {
        Notification n = new Notification();
        n.setUserId(userId);
        n.setType(type);
        n.setTitle(title);
        n.setMessage(message);
        n.setStatus(status);
        n.setCategory(category);
        n.setRelatedEntityId(relatedEntityId);
        n.setCreatedAt(createdAt);
        n.setSentAt(sentAt);
        n.setReadAt(readAt);
        notificationRepository.save(n);
    }
}
