package com.procurement.rfqbiddingservice.config;

import com.procurement.rfqbiddingservice.entity.Bid;
import com.procurement.rfqbiddingservice.entity.RFQ;
import com.procurement.rfqbiddingservice.repository.BidRepository;
import com.procurement.rfqbiddingservice.repository.RFQRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Component
@RequiredArgsConstructor
@Slf4j
public class DataInitializer implements CommandLineRunner {

    private final RFQRepository rfqRepository;
    private final BidRepository bidRepository;

    @Override
    public void run(String... args) {
        if (rfqRepository.count() == 0) {
            initRFQsAndBids();
        }
    }

    private void initRFQsAndBids() {
        // User IDs from auth-service seed:
        //   alice (officer) = 2, bob (officer) = 3
        // Vendor IDs from vendor-service seed:
        //   TechSupply=1, BuildRight=2, OfficeEssentials=3, ElectroWorld=4, FurniturePlus=5
        // Category IDs: IT=1, Construction=2, Stationery=3, Electronics=4, Furniture=5

        LocalDateTime now = LocalDateTime.now();

        // ── RFQ 1: Open – IT Laptops ──────────────────────────────────────────
        // Created 18 days ago, deadline in 12 days — 3 competing bids
        RFQ rfq1 = createRFQ(
                "Laptop Procurement Q3 2025",
                "Supply of 50 high-performance laptops for the engineering department. " +
                "Minimum specs: 16GB RAM, 512GB SSD, Intel i7 or AMD Ryzen 7 equivalent. " +
                "Includes delivery, asset tagging, and 3-year on-site warranty.",
                now.minusDays(18), now.plusDays(12), "Open", 2L,
                new BigDecimal("75000.00"), 1L, 50);

        // ── RFQ 2: Open – Office Furniture ───────────────────────────────────
        // Created 12 days ago, deadline in 18 days — 2 competing bids
        RFQ rfq2 = createRFQ(
                "Office Furniture Refresh 2025",
                "Supply and installation of ergonomic office chairs and height-adjustable " +
                "standing desks for 30 workstations in the new headquarters building. " +
                "Delivery and assembly included. Minimum 5-year product warranty.",
                now.minusDays(12), now.plusDays(18), "Open", 2L,
                new BigDecimal("45000.00"), 5L, 30);

        // ── RFQ 3: Closed – Annual Stationery Supply ──────────────────────────
        // Created 35 days ago, deadline was 5 days ago — 3 bids received
        RFQ rfq3 = createRFQ(
                "Annual Stationery Supply Contract",
                "Yearly supply of office stationery including A4 paper (80gsm), ballpoint pens, " +
                "file folders, sticky notes, staples, and other consumables for all departments. " +
                "Monthly delivery schedule required.",
                now.minusDays(35), now.minusDays(5), "Closed", 3L,
                new BigDecimal("12000.00"), 3L, 1000);

        // ── RFQ 4: Awarded – Server Room Renovation ───────────────────────────
        // Created 60 days ago, deadline was 30 days ago — BuildRight won
        RFQ rfq4 = createRFQ(
                "Server Room Renovation",
                "Full renovation of the primary server room including raised anti-static flooring, " +
                "precision cooling system upgrade (CRAC units), structured cable management, " +
                "and fire suppression system inspection. Certified data centre contractor required.",
                now.minusDays(60), now.minusDays(30), "Awarded", 2L,
                new BigDecimal("120000.00"), 2L, 1);

        // ── RFQ 5: Open – Network Equipment Upgrade ───────────────────────────
        // Created 8 days ago, deadline in 12 days — 3 competing bids
        RFQ rfq5 = createRFQ(
                "Network Equipment Upgrade",
                "Supply and configuration of enterprise managed switches (24-port), wireless access " +
                "points (Wi-Fi 6), and next-generation firewalls for the office network infrastructure " +
                "upgrade. Includes 1-year support contract and on-site configuration.",
                now.minusDays(8), now.plusDays(12), "Open", 3L,
                new BigDecimal("35000.00"), 4L, 20);

        // ── RFQ 6: Closed – Stationery Supply Q1 2025 (older contract) ────────
        // Created 95 days ago, deadline was 65 days ago — OfficeEssentials won (→ PO 5)
        RFQ rfq6 = createRFQ(
                "Stationery Supply Q1 2025",
                "Q1 2025 supply of office stationery: 900 reams A4 paper, 50 boxes pens, " +
                "500 file folders, 100 packs sticky notes. Single bulk delivery to warehouse.",
                now.minusDays(95), now.minusDays(65), "Closed", 3L,
                new BigDecimal("11000.00"), 3L, 900);

        // ── RFQ 7: Open – IT Security Software Licenses ───────────────────────
        // New RFQ raised by alice, deadline in 20 days — 1 early bid
        RFQ rfq7 = createRFQ(
                "IT Security Software Licensing",
                "Annual licensing for endpoint security suite (EDR/XDR) covering 200 endpoints. " +
                "Must include centralised management console, threat intelligence feed, and " +
                "24/7 SOC monitoring. Vendor must be certified under ISO 27001.",
                now.minusDays(5), now.plusDays(20), "Open", 2L,
                new BigDecimal("28000.00"), 1L, 200);

        // ═══════════════════════════════════════════════════════════════════════
        // BIDS
        // ═══════════════════════════════════════════════════════════════════════

        // ── Bids for RFQ 1 (Open – Laptops) ──────────────────────────────────
        // Vendor 1: TechSupply — Dell XPS bundle, best specs, highest price
        createBid(rfq1.getRfqId(), 1L, new BigDecimal("72000.00"), "Pending",
                now.minusDays(12),
                "Dell XPS 15 laptops — 16GB DDR5 RAM, 512GB NVMe SSD, Intel i7-13th Gen, " +
                "OLED 4K display. Bundle includes laptop bags, docking stations, and " +
                "3-year on-site NBD warranty. Free asset tagging and deployment service.",
                10, new BigDecimal("88.0"), new BigDecimal("86.5"));

        // Vendor 3: OfficeEssentials — Lenovo bundle, cheaper but longer delivery
        createBid(rfq1.getRfqId(), 3L, new BigDecimal("68500.00"), "Pending",
                now.minusDays(10),
                "Lenovo ThinkPad X1 Carbon Gen 11 — 16GB LPDDR5 RAM, 512GB SSD, " +
                "Intel i7-1365U. Known for durability and long battery life. " +
                "2-year on-site warranty. Competitive pricing per unit.",
                14, new BigDecimal("82.0"), new BigDecimal("80.5"));

        // Vendor 4: ElectroWorld — ASUS ProArt bundle, mid-range price
        createBid(rfq1.getRfqId(), 4L, new BigDecimal("70000.00"), "Pending",
                now.minusDays(7),
                "ASUS ProArt Studiobook 16 — 32GB DDR5 RAM, 1TB NVMe SSD, AMD Ryzen 9 7945HX. " +
                "Exceeds spec requirements. Ideal for engineering workloads. " +
                "3-year warranty, includes carry cases.",
                12, new BigDecimal("85.0"), new BigDecimal("83.0"));

        // ── Bids for RFQ 2 (Open – Furniture) ────────────────────────────────
        // Vendor 5: FurniturePlus — Herman Miller / Uplift, premium
        createBid(rfq2.getRfqId(), 5L, new BigDecimal("42000.00"), "Pending",
                now.minusDays(9),
                "Herman Miller Aeron ergonomic chairs (size B) and Uplift V2 Commercial " +
                "sit-stand desks (72x30 inch). Professional installation team included. " +
                "5-year warranty on all products. showroom visit available.",
                21, new BigDecimal("92.0"), new BigDecimal("90.0"));

        // Vendor 3: OfficeEssentials — budget alternative furniture
        createBid(rfq2.getRfqId(), 3L, new BigDecimal("36500.00"), "Pending",
                now.minusDays(6),
                "Steelcase Leap V2 ergonomic chairs and Flexispot E7 Pro electric desks. " +
                "Competitively priced with equivalent ergonomic certification. " +
                "Assembly included. 3-year warranty.",
                18, new BigDecimal("78.0"), new BigDecimal("76.5"));

        // ── Bids for RFQ 3 (Closed – Annual Stationery) ──────────────────────
        // Vendor 3: OfficeEssentials — ACCEPTED (→ PO 2)
        createBid(rfq3.getRfqId(), 3L, new BigDecimal("11200.00"), "Accepted",
                now.minusDays(28),
                "Comprehensive stationery package: A4 80gsm paper (HP brand), Bic pens, " +
                "Avery folders, 3M sticky notes. Monthly delivery schedule, dedicated account " +
                "manager, online order portal. ISO 9001 certified supply chain.",
                7, new BigDecimal("90.0"), new BigDecimal("88.5"));

        // Vendor 1: TechSupply — Rejected (higher price, IT focus mismatch)
        createBid(rfq3.getRfqId(), 1L, new BigDecimal("11800.00"), "Rejected",
                now.minusDays(25),
                "Premium stationery brands: Navigator paper, Pentel pens. " +
                "Quarterly bulk delivery with 5% early payment discount.",
                14, new BigDecimal("80.0"), new BigDecimal("78.0"));

        // Vendor 5: FurniturePlus — Rejected (category mismatch)
        createBid(rfq3.getRfqId(), 5L, new BigDecimal("12400.00"), "Rejected",
                now.minusDays(22),
                "Office consumables package including paper and stationery items. " +
                "Add-on service: free desk organisers with bulk order.",
                10, new BigDecimal("72.0"), new BigDecimal("71.0"));

        // ── Bids for RFQ 4 (Awarded – Server Room Renovation) ─────────────────
        // Vendor 2: BuildRight — AWARDED (→ PO 1)
        createBid(rfq4.getRfqId(), 2L, new BigDecimal("115000.00"), "Awarded",
                now.minusDays(55),
                "Complete server room renovation — ISO 9001 certified contractor. " +
                "Raised anti-static floor tiles (Tate Systems), Stulz precision CRAC units, " +
                "Panduit structured cabling, Kidde FM-200 fire suppression inspection. " +
                "45-day project plan with weekly progress reports.",
                45, new BigDecimal("95.0"), new BigDecimal("93.5"));

        // Vendor 1: TechSupply — Rejected (higher price, less construction experience)
        createBid(rfq4.getRfqId(), 1L, new BigDecimal("118500.00"), "Rejected",
                now.minusDays(52),
                "Data centre upgrade with premium materials. APC cooling system, " +
                "Legrand cabling infrastructure. 60-day completion.",
                60, new BigDecimal("88.0"), new BigDecimal("85.0"));

        // Vendor 4: ElectroWorld — Rejected (electronics vendor, scope mismatch)
        createBid(rfq4.getRfqId(), 4L, new BigDecimal("122000.00"), "Rejected",
                now.minusDays(50),
                "IT infrastructure renovation — specialising in rack installation, " +
                "UPS systems, and network hardware. Subcontracting civil works.",
                55, new BigDecimal("76.0"), new BigDecimal("74.0"));

        // ── Bids for RFQ 5 (Open – Network Equipment) ─────────────────────────
        // Vendor 4: ElectroWorld — best price and fit (electronics specialist)
        createBid(rfq5.getRfqId(), 4L, new BigDecimal("33000.00"), "Pending",
                now.minusDays(6),
                "Cisco Catalyst 9200 managed switches, Cisco Meraki MR57 Wi-Fi 6E APs, " +
                "Fortinet FortiGate 200F next-gen firewall. Full configuration, " +
                "1-year TAC support included. Cisco Certified engineers on-site.",
                7, new BigDecimal("91.0"), new BigDecimal("89.0"));

        // Vendor 1: TechSupply — HP Aruba alternative
        createBid(rfq5.getRfqId(), 1L, new BigDecimal("34500.00"), "Pending",
                now.minusDays(4),
                "HP Aruba 6300M switches, Aruba AP-635 access points, Palo Alto PA-450 " +
                "next-gen firewall. Lifetime firmware updates, ArubaOS Central cloud management, " +
                "24/7 NOC support.",
                10, new BigDecimal("89.0"), new BigDecimal("87.0"));

        // Vendor 3: OfficeEssentials — lower quality bid, category mismatch
        createBid(rfq5.getRfqId(), 3L, new BigDecimal("31500.00"), "Pending",
                now.minusDays(2),
                "TP-Link Omada Business Wi-Fi 6 system with managed switches and edge router. " +
                "Budget-friendly option with cloud management. 3-year warranty.",
                14, new BigDecimal("70.0"), new BigDecimal("68.5"));

        // ── Bids for RFQ 6 (Closed – Stationery Q1 2025) ─────────────────────
        // Vendor 3: OfficeEssentials — AWARDED (→ PO 5, which had delivery dispute)
        createBid(rfq6.getRfqId(), 3L, new BigDecimal("10800.00"), "Awarded",
                now.minusDays(82),
                "Complete Q1 stationery package: 900 reams A4 paper (80gsm, HP), " +
                "50 boxes Bic ballpoint pens, 500 manila folders, 100 packs 3M sticky notes. " +
                "Single bulk delivery within 7 days. Dedicated account manager assigned.",
                7, new BigDecimal("88.0"), new BigDecimal("86.5"));

        // Vendor 1: TechSupply — Rejected
        createBid(rfq6.getRfqId(), 1L, new BigDecimal("11500.00"), "Rejected",
                now.minusDays(79),
                "Premium stationery brands. Bi-weekly bulk delivery schedule.",
                14, new BigDecimal("83.0"), new BigDecimal("81.0"));

        // ── Bids for RFQ 7 (Open – IT Security Software) ──────────────────────
        // Vendor 1: TechSupply — early bid, strong fit (IT vendor, ISO 27001)
        createBid(rfq7.getRfqId(), 1L, new BigDecimal("26500.00"), "Pending",
                now.minusDays(2),
                "CrowdStrike Falcon Complete MDR — EDR/XDR for 200 endpoints, " +
                "Threat Graph AI detection, Falcon OverWatch 24/7 SOC, centralised dashboard. " +
                "ISO 27001 certified implementation partner. Annual subscription with SLA guarantee.",
                5, new BigDecimal("93.0"), new BigDecimal("91.5"));

        log.info("RFQs and Bids initialized: 7 RFQs, 16 bids");
    }

    private RFQ createRFQ(String title, String description,
                           LocalDateTime createdAt, LocalDateTime deadline,
                           String status, Long createdBy, BigDecimal estimatedValue,
                           Long categoryId, Integer expectedQuantity) {
        RFQ rfq = new RFQ();
        rfq.setTitle(title);
        rfq.setDescription(description);
        rfq.setDeadline(deadline);
        rfq.setStatus(status);
        rfq.setCreatedBy(createdBy);
        rfq.setCreatedAt(createdAt);
        rfq.setEstimatedValue(estimatedValue);
        rfq.setCategoryId(categoryId);
        rfq.setExpectedQuantity(expectedQuantity);
        return rfqRepository.save(rfq);
    }

    private void createBid(Long rfqId, Long vendorId, BigDecimal bidAmount, String status,
                            LocalDateTime submittedAt, String proposalText,
                            Integer deliveryDays, BigDecimal qualityScore, BigDecimal totalScore) {
        Bid bid = new Bid();
        bid.setRfqId(rfqId);
        bid.setVendorId(vendorId);
        bid.setBidAmount(bidAmount);
        bid.setStatus(status);
        bid.setSubmittedAt(submittedAt);
        bid.setProposalText(proposalText);
        bid.setDeliveryDays(deliveryDays);
        bid.setQualityScore(qualityScore);
        bid.setTotalScore(totalScore);
        bidRepository.save(bid);
    }
}
