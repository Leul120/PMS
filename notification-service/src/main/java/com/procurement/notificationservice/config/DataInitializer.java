package com.procurement.notificationservice.config;

import com.procurement.notificationservice.entity.Notification;
import com.procurement.notificationservice.repository.NotificationRepository;
import com.procurement.notificationservice.util.NotificationRouteBuilder;
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
            return;
        }
        // One-time repair: seed data used userId 1 for admin before super-admin (user 1) existed.
        boolean legacyOffset = notificationRepository.findAll().stream()
            .anyMatch(n -> n.getUserId() != null && n.getUserId() == 1L
                && n.getTitle() != null && n.getTitle().contains("ElectroWorld"));
        if (legacyOffset) {
            log.warn("Repairing legacy notification userId mapping (+1 for users 1–12)…");
            notificationRepository.findAll().forEach(n -> {
                if (n.getUserId() != null && n.getUserId() >= 1L && n.getUserId() <= 12L) {
                    n.setUserId(n.getUserId() + 1);
                    notificationRepository.save(n);
                }
            });
            log.info("Notification userId repair complete");
        }
    }

    private void initNotifications() {
        // User IDs from auth-service seed (super admin is user 1 on system tenant):
        //   admin=2, alice(officer)=3, bob(officer)=4, carol(manager)=5,
        //   david(manager)=6, vendor1(TechSupply)=7, vendor2(BuildRight)=8,
        //   vendor3(OfficeEssentials)=9, vendor4(ElectroWorld)=10, vendor5(FurniturePlus)=11,
        //   eve(auditor)=12, frank(director)=13, grace(requester)=14
        // RFQ IDs: 1=Laptops, 2=Furniture, 3=AnnualStationery, 4=ServerRoom, 5=Network,
        //          6=StationeryQ1, 7=ITSecurity
        // PO IDs:  1=Closed, 2=Dispatched, 3=PendingApproval, 4=Approved, 5=Closed(dispute)

        LocalDateTime now = LocalDateTime.now();

        // ═══════════════════════════════════════════════════════════════════════
        // BID DEADLINE REMINDERS
        // ═══════════════════════════════════════════════════════════════════════

        // Bid deadline for Laptop RFQ — alice must evaluate bids
        notif(3L, "IN_APP", "Bid Deadline Approaching – Laptop Procurement",
                "RFQ 'Laptop Procurement Q3 2025' closes in 24 hours. 3 bids received. " +
                "Review and select preferred vendor before deadline.",
                "SENT", "BID_DEADLINE", "1", now.minusHours(24), now.minusHours(24), null);

        // Bid deadline for Network Equipment — bob
        notif(4L, "IN_APP", "Bid Deadline Approaching – Network Equipment",
                "RFQ 'Network Equipment Upgrade' closes in 24 hours. 3 bids received. " +
                "ElectroWorld Co leads on price and technical fit.",
                "SENT", "BID_DEADLINE", "5", now.minusHours(10), now.minusHours(10), null);

        // RFQ 3 (Annual Stationery) closed — alice must action bid evaluation
        notif(3L, "EMAIL", "RFQ Closed – Action Required",
                "RFQ 'Annual Stationery Supply Contract' has closed with 3 bids received. " +
                "Please evaluate bids and select a winner to proceed to PO creation.",
                "SENT", "BID_DEADLINE", "3", now.minusDays(5), now.minusDays(5), null);

        // IT Security RFQ opened — TechSupply notified (their category)
        notif(7L, "IN_APP", "New RFQ Available – IT Security Software",
                "A new RFQ 'IT Security Software Licensing' (RFQ #7) matching your IT category " +
                "is open for bidding. Deadline: 20 days. Estimated value: $28,000.",
                "SENT", "BID_DEADLINE", "7", now.minusDays(5), now.minusDays(5), null);

        // ElectroWorld notified about Network Equipment RFQ
        notif(10L, "IN_APP", "New RFQ Available – Network Equipment Upgrade",
                "A new RFQ 'Network Equipment Upgrade' (RFQ #5) matching your Electronics category " +
                "is open for bidding. Deadline: 12 days. Estimated value: $35,000.",
                "SENT", "BID_DEADLINE", "5", now.minusDays(8), now.minusDays(8), null);

        // FurniturePlus notified about Furniture RFQ
        notif(11L, "IN_APP", "New RFQ Available – Office Furniture Refresh",
                "A new RFQ 'Office Furniture Refresh 2025' (RFQ #2) matching your Furniture category " +
                "is open for bidding. Deadline: 18 days. Estimated value: $45,000.",
                "READ", "BID_DEADLINE", "2", now.minusDays(12), now.minusDays(12), now.minusDays(11));

        // OfficeEssentials notified about Laptop RFQ (they submitted a bid)
        notif(9L, "IN_APP", "New RFQ Available – Laptop Procurement",
                "A new RFQ 'Laptop Procurement Q3 2025' (RFQ #1) is open for bidding. " +
                "Your bid has been successfully submitted.",
                "READ", "BID_DEADLINE", "1", now.minusDays(18), now.minusDays(18), now.minusDays(17));

        // ═══════════════════════════════════════════════════════════════════════
        // APPROVAL PENDING
        // ═══════════════════════════════════════════════════════════════════════

        // David (manager) — PO #3 Furniture awaiting his approval
        notif(6L, "IN_APP", "Purchase Order Awaiting Approval – PO #3",
                "PO #3 for Office Furniture Refresh (FurniturePlus LLC, $42,000) requires your approval. " +
                "Standing desks are out of stock and blocking the new HQ setup.",
                "SENT", "APPROVAL_PENDING", "3", now.minusDays(3), now.minusDays(3), null);

        // David (manager) — PR-2025-003 Network Equipment pending his review
        notif(6L, "IN_APP", "Purchase Requisition Pending Review – PR-2025-003",
                "PR-2025-003 (Network Equipment Upgrade, $35,000) submitted by Alice Johnson awaits " +
                "your approval. 3 switches, 10 APs, and 2 routers requested.",
                "SENT", "APPROVAL_PENDING", "3", now.minusDays(5), now.minusDays(5), null);

        // David (manager) — PR-2025-007 Conference room pending his review
        notif(6L, "IN_APP", "Purchase Requisition Pending Review – PR-2025-007",
                "PR-2025-007 (Conference Room AV Upgrade, $22,000) submitted by Bob Martinez " +
                "awaits your approval. Boardroom projector and sound system replacement.",
                "SENT", "APPROVAL_PENDING", "7", now.minusDays(1), now.minusDays(1), null);

        // Carol (manager) — PO #4 Laptops approved email confirmation
        notif(5L, "EMAIL", "PO #4 Approved – Laptop Procurement",
                "Purchase Order #4 for Laptop Procurement (TechSupply Corp, $72,000) has been approved. " +
                "Expected delivery in 14 days. Vendor has been notified.",
                "READ", "APPROVAL_PENDING", "4", now.minusDays(4), now.minusDays(4), now.minusDays(3));

        // Carol (manager) — PO #1 Server Room high-value approval email (historical)
        notif(5L, "EMAIL", "High-Value PO Approved – PO #1 ($115,000)",
                "Purchase Order #1 for Server Room Renovation (BuildRight Ltd, $115,000) has been " +
                "approved and issued. Vendor project timeline: 45 days. Expected completion: on schedule.",
                "READ", "APPROVAL_PENDING", "1", now.minusDays(54), now.minusDays(54), now.minusDays(53));

        // Carol (manager) — PO #3 Furniture urgent email
        notif(5L, "EMAIL", "PO #3 Awaiting Your Approval – Urgent",
                "PO #3 for Office Furniture Refresh (FurniturePlus LLC, $42,000) has been pending " +
                "approval for 3 days. Standing desks are out of stock — new HQ setup is blocked.",
                "SENT", "APPROVAL_PENDING", "3", now.minusDays(3), now.minusDays(3), null);

        // Director (frank, userId=12) — high-value PO #1 awareness notification
        notif(13L, "IN_APP", "High-Value Purchase Order Issued – PO #1",
                "PO #1 for Server Room Renovation (BuildRight Ltd, $115,000) has been approved " +
                "by Carol Williams. Project completed successfully. Invoice paid.",
                "READ", "APPROVAL_PENDING", "1", now.minusDays(52), now.minusDays(52), now.minusDays(50));

        // Director — PO #4 Laptops awareness (above threshold)
        notif(13L, "IN_APP", "High-Value Purchase Order Approved – PO #4",
                "PO #4 for Laptop Procurement (TechSupply Corp, $72,000) approved by Carol Williams. " +
                "Delivery expected in 14 days.",
                "READ", "APPROVAL_PENDING", "4", now.minusDays(4), now.minusDays(4), now.minusDays(3));

        // Director — monthly spend report
        notif(13L, "EMAIL", "Monthly Procurement Spend Report – April 2025",
                "Total procurement spend this month: $198,000 across 4 active POs. " +
                "Largest: PO #1 Server Room Renovation ($115,000). Budget utilisation: 76%. " +
                "Full report available in the Analytics dashboard.",
                "READ", "APPROVAL_PENDING", null, now.minusDays(14), now.minusDays(14), now.minusDays(13));

        // ═══════════════════════════════════════════════════════════════════════
        // DELIVERY UPDATES
        // ═══════════════════════════════════════════════════════════════════════

        // Alice — PO #2 Stationery dispatched
        notif(3L, "IN_APP", "Order Dispatched – PO #2 Stationery Supply",
                "PO #2 (Annual Stationery Supply, OfficeEssentials Inc) has been dispatched. " +
                "Tracking: OE-2025-0892. Expected delivery in 5 days.",
                "READ", "DELIVERY_UPDATE", "2", now.minusDays(15), now.minusDays(15), now.minusDays(14));

        // Carol — PO #5 Stationery (old) delivered and closed
        notif(5L, "IN_APP", "Delivery Confirmed – PO #5 Closed",
                "PO #5 (Stationery Supply Q1 2025) has been delivered and closed after dispute resolution. " +
                "810 reams received, revised invoice of $9,720 paid.",
                "READ", "DELIVERY_UPDATE", "5", now.minusDays(20), now.minusDays(20), now.minusDays(19));

        // Alice — PO #1 Server Room delivery confirmed (historical)
        notif(3L, "IN_APP", "Delivery Confirmed – PO #1 Server Room Renovation",
                "PO #1 (Server Room Renovation, BuildRight Ltd) has been delivered and signed off. " +
                "Three-way match validated. Invoice #1 ($115,000) approved for payment.",
                "READ", "DELIVERY_UPDATE", "1", now.minusDays(10), now.minusDays(10), now.minusDays(9));

        // BuildRight (vendor2) — their delivery was confirmed
        notif(8L, "IN_APP", "Delivery Accepted – PO #1 Server Room Renovation",
                "Your delivery for PO #1 (Server Room Renovation) has been accepted and signed off. " +
                "Invoice #1 ($115,000) has been approved for payment. Payment expected within 30 days.",
                "READ", "DELIVERY_UPDATE", "1", now.minusDays(10), now.minusDays(10), now.minusDays(9));

        // BuildRight — bid awarded notification
        notif(8L, "IN_APP", "Bid Awarded – Server Room Renovation",
                "Congratulations! Your bid of $115,000 for 'Server Room Renovation' (RFQ #4) " +
                "has been awarded. PO #1 will be issued within 2 business days.",
                "READ", "DELIVERY_UPDATE", "4", now.minusDays(55), now.minusDays(55), now.minusDays(54));

        // OfficeEssentials — their bid was accepted (annual stationery)
        notif(9L, "IN_APP", "Bid Accepted – Annual Stationery Supply Contract",
                "Your bid of $11,200 for 'Annual Stationery Supply Contract' (RFQ #3) has been accepted. " +
                "PO #2 will be issued. Please confirm delivery schedule.",
                "READ", "BID_DEADLINE", "3", now.minusDays(18), now.minusDays(18), now.minusDays(17));

        // ═══════════════════════════════════════════════════════════════════════
        // VENDOR ALERTS
        // ═══════════════════════════════════════════════════════════════════════

        // Admin — ElectroWorld new registration
        notif(2L, "IN_APP", "New Vendor Registration – ElectroWorld Co",
                "ElectroWorld Co has registered and submitted compliance documents. " +
                "4 documents pending verification. Assigned to compliance team for review.",
                "READ", "VENDOR_ALERT", "4", now.minusDays(45), now.minusDays(45), now.minusDays(44));

        // Admin — BuildRight tax cert expiring soon (30 days)
        notif(2L, "IN_APP", "Vendor Document Expiring – BuildRight Ltd",
                "BuildRight Ltd's Tax Clearance Certificate expires in 30 days. " +
                "Please request renewal. Certificate is required for active POs.",
                "SENT", "VENDOR_ALERT", "2", now.minusDays(1), now.minusDays(1), null);

        // Admin — OfficeEssentials expired tax cert (flagged)
        notif(2L, "IN_APP", "Vendor Document Expired – OfficeEssentials Inc",
                "OfficeEssentials Inc's Tax Clearance Certificate has expired. " +
                "Vendor has uploaded a renewed certificate — pending admin verification.",
                "SENT", "VENDOR_ALERT", "3", now.minusDays(5), now.minusDays(5), null);

        // ElectroWorld — compliance verification pending
        notif(10L, "IN_APP", "Compliance Verification In Progress",
                "Your vendor registration is under review. 4 documents submitted are being verified " +
                "by the procurement compliance team. You will be notified within 5 business days.",
                "SENT", "VENDOR_ALERT", null, now.minusDays(44), now.minusDays(44), null);

        // ElectroWorld — bid submitted confirmation for RFQ 5
        notif(10L, "IN_APP", "Bid Submitted – Network Equipment Upgrade",
                "Your bid of $33,000 for 'Network Equipment Upgrade' (RFQ #5) has been submitted. " +
                "Bid deadline: 12 days remaining. You will be notified of the outcome.",
                "READ", "VENDOR_ALERT", "5", now.minusDays(6), now.minusDays(6), now.minusDays(5));

        // ═══════════════════════════════════════════════════════════════════════
        // DISPUTE NOTIFICATIONS
        // ═══════════════════════════════════════════════════════════════════════

        // Bob — dispute raised (PO #5 short delivery)
        notif(4L, "IN_APP", "Dispute Raised – PO #5 Quantity Mismatch",
                "Dispute #1 raised on PO #5 (Stationery Supply, OfficeEssentials). " +
                "810 of 900 reams delivered but full $10,800 invoiced. Awaiting manager review.",
                "READ", "DELIVERY_UPDATE", "5", now.minusDays(27), now.minusDays(27), now.minusDays(26));

        // Carol — dispute resolved
        notif(5L, "IN_APP", "Dispute Resolved – PO #5",
                "Dispute #1 on PO #5 resolved. OfficeEssentials Inc issued a revised invoice " +
                "of $9,720 for the 810 reams actually delivered. Original invoice #4 voided.",
                "READ", "DELIVERY_UPDATE", "5", now.minusDays(21), now.minusDays(21), now.minusDays(20));

        // OfficeEssentials (vendor) — dispute filed against them
        notif(9L, "IN_APP", "Dispute Filed – Invoice Discrepancy on PO #5",
                "A quantity mismatch dispute (Dispute #1) has been filed against your invoice on PO #5. " +
                "810 reams delivered vs 900 ordered. Please issue a revised invoice for $9,720.",
                "READ", "DELIVERY_UPDATE", "5", now.minusDays(27), now.minusDays(27), now.minusDays(25));

        // OfficeEssentials — revised invoice request email
        notif(9L, "EMAIL", "Action Required – Revised Invoice for PO #5",
                "Please issue a revised invoice for PO #5 reflecting 810 reams at $12/ream = $9,720. " +
                "The original invoice #4 ($10,800) has been disputed and voided. " +
                "Revised invoice required within 3 business days.",
                "READ", "DELIVERY_UPDATE", "5", now.minusDays(24), now.minusDays(24), now.minusDays(22));

        // Bob — new price dispute on PO #2 (freight surcharge)
        notif(4L, "IN_APP", "Price Dispute Opened – PO #2",
                "Dispute #3 raised on PO #2 (Annual Stationery, OfficeEssentials). " +
                "Vendor added $300 freight surcharge not included in original contract. Awaiting resolution.",
                "SENT", "DELIVERY_UPDATE", "2", now.minusDays(1), now.minusDays(1), null);

        // Director — awareness of active disputes
        notif(13L, "IN_APP", "Dispute Activity Summary",
                "4 disputes recorded this period: Dispute #1 & #2 resolved/closed, " +
                "Dispute #3 open (price mismatch PO #2), Dispute #4 under review (delayed delivery PO #5). " +
                "Total disputed value: $11,380.",
                "SENT", "VENDOR_ALERT", null, now.minusDays(5), now.minusDays(5), null);

        // ═══════════════════════════════════════════════════════════════════════
        // THREE-WAY MATCH ALERTS
        // ═══════════════════════════════════════════════════════════════════════

        // Alice — PO #1 three-way match passed
        notif(3L, "IN_APP", "Three-Way Match Validated – PO #1",
                "PO #1 (Server Room Renovation) three-way match completed: PO, delivery, and invoice " +
                "all confirmed. Invoice #1 ($115,000) approved for payment processing.",
                "READ", "DELIVERY_UPDATE", "1", now.minusDays(5), now.minusDays(5), now.minusDays(4));

        // Carol — PO #5 three-way match mismatch
        notif(5L, "IN_APP", "Three-Way Match Mismatch – PO #5",
                "Three-way match for PO #5: quantity mismatch detected. 810 reams delivered vs 900 ordered. " +
                "Invoice #4 flagged. Dispute #1 raised and resolved — revised invoice #5 ($9,720) paid.",
                "READ", "DELIVERY_UPDATE", "5", now.minusDays(26), now.minusDays(26), now.minusDays(25));

        // ═══════════════════════════════════════════════════════════════════════
        // LOW INVENTORY ALERTS
        // ═══════════════════════════════════════════════════════════════════════

        // Alice — critical laptop stock (triggered PR-2025-001)
        notif(3L, "IN_APP", "Critical Stock Alert – Laptops (IT-001)",
                "IT-001 (Laptop - Dell XPS 15) is critically low: 2 units remaining (min: 10). " +
                "PR-2025-001 raised and approved. PO #4 (TechSupply, $72,000) approved. " +
                "Delivery expected in 14 days.",
                "READ", "VENDOR_ALERT", null, now.minusDays(40), now.minusDays(40), now.minusDays(39));

        // Alice — standing desks out of stock (triggered PR-2025-002)
        notif(3L, "IN_APP", "Critical Stock Alert – Standing Desks (FN-002)",
                "FN-002 (Standing Desk) is out of stock. PR-2025-002 raised for 30 units. " +
                "PO #3 (FurniturePlus LLC, $42,000) pending manager approval.",
                "SENT", "VENDOR_ALERT", null, now.minusDays(3), now.minusDays(3), null);

        // Alice — network equipment low (triggered PR-2025-003)
        notif(3L, "IN_APP", "Low Stock Alert – Network Equipment",
                "EL-001 (Network Switch 24-Port): 1 unit remaining. " +
                "EL-003 (Router - Enterprise): 0 units remaining. " +
                "PR-2025-003 (Network Equipment, $35,000) pending manager approval.",
                "SENT", "VENDOR_ALERT", null, now.minusDays(5), now.minusDays(5), null);

        // Admin — sticky notes out of stock (systemic gap)
        notif(2L, "IN_APP", "Stock-Out Alert – Sticky Notes (OS-004)",
                "OS-004 (Sticky Notes Pack) is completely out of stock (0 packs). " +
                "Replenishment included in PO #2 (Stationery Supply, OfficeEssentials) — in transit.",
                "SENT", "VENDOR_ALERT", null, now.minusDays(2), now.minusDays(2), null);

        // ═══════════════════════════════════════════════════════════════════════
        // AUDITOR NOTIFICATIONS
        // ═══════════════════════════════════════════════════════════════════════

        // Eve (auditor) — monthly compliance report
        notif(12L, "IN_APP", "Monthly Compliance Report Ready – April 2025",
                "Vendor compliance report for April 2025 is ready for review. " +
                "5 vendors: 4 Verified, 1 Pending. 2 document expirations flagged. " +
                "Full report in the Compliance dashboard.",
                "SENT", "VENDOR_ALERT", null, now.minusDays(10), now.minusDays(10), null);

        // Eve (auditor) — dispute activity summary
        notif(12L, "IN_APP", "Dispute Activity Summary – Q2 2025",
                "4 disputes recorded this quarter: 2 resolved/closed, 1 open, 1 under review. " +
                "Total disputed value: $11,380. Vendor at most risk: OfficeEssentials Inc (2 disputes).",
                "SENT", "VENDOR_ALERT", null, now.minusDays(5), now.minusDays(5), null);

        // Eve (auditor) — PO spend audit alert
        notif(12L, "EMAIL", "Audit Alert – High-Value PO Approved",
                "PO #1 (Server Room Renovation, BuildRight Ltd, $115,000) was approved and completed. " +
                "Three-way match validated. Invoice paid. No compliance issues identified.",
                "READ", "APPROVAL_PENDING", "1", now.minusDays(52), now.minusDays(52), now.minusDays(51));

        // Eve — ElectroWorld pending verification notice
        notif(12L, "IN_APP", "New Vendor Pending Verification – ElectroWorld Co",
                "ElectroWorld Co has submitted 4 compliance documents for verification. " +
                "Please complete the compliance review within 5 business days.",
                "SENT", "VENDOR_ALERT", "4", now.minusDays(43), now.minusDays(43), null);

        // ═══════════════════════════════════════════════════════════════════════
        // DIRECTOR NOTIFICATIONS
        // ═══════════════════════════════════════════════════════════════════════

        // Frank (director) — quarterly spend summary
        notif(13L, "EMAIL", "Quarterly Procurement Report – Q1 2025",
                "Q1 2025 procurement spend: $128,000. POs closed: 2. Active POs: 3. " +
                "Top vendor by spend: BuildRight Ltd ($115,000). Savings vs budget: 8%. " +
                "Full analytics available in the dashboard.",
                "READ", "APPROVAL_PENDING", null, now.minusDays(45), now.minusDays(45), now.minusDays(44));

        // Frank (director) — vendor risk alert
        notif(13L, "IN_APP", "Vendor Risk Alert – OfficeEssentials Inc",
                "OfficeEssentials Inc risk level: MEDIUM. 2 disputes raised this quarter, " +
                "tax certificate recently expired (now renewed). " +
                "Consider dual-sourcing stationery supply to reduce dependency.",
                "SENT", "VENDOR_ALERT", "3", now.minusDays(3), now.minusDays(3), null);

        log.info("Notifications initialized: 42 records");
    }

    private void notif(Long userId, String type, String title, String message,
                        String status, String category, String relatedEntityId,
                        LocalDateTime createdAt, LocalDateTime sentAt, LocalDateTime readAt) {
        Notification n = new Notification();
        n.setTenantId(1L);
        n.setUserId(userId);
        n.setType(type);
        n.setTitle(title);
        n.setMessage(message);
        n.setStatus(status);
        n.setCategory(category);
        n.setRelatedEntityId(relatedEntityId);
        n.setActionUrl(NotificationRouteBuilder.build(category, relatedEntityId, title));
        n.setCreatedAt(createdAt);
        n.setSentAt(sentAt);
        n.setReadAt(readAt);
        notificationRepository.save(n);
    }
}
