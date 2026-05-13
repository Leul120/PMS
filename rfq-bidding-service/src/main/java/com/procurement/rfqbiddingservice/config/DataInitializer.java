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

        // ── RFQ 1: Open – IT laptops ──────────────────────────────────────────
        RFQ rfq1 = createRFQ(
                "Laptop Procurement Q3 2025",
                "Supply of 50 high-performance laptops for the engineering department. " +
                "Minimum specs: 16GB RAM, 512GB SSD, Intel i7 or equivalent.",
                now.plusDays(14), "Open", 2L,
                new BigDecimal("75000.00"), 1L, 50);

        // ── RFQ 2: Open – Office furniture ───────────────────────────────────
        RFQ rfq2 = createRFQ(
                "Office Furniture Refresh 2025",
                "Supply and installation of ergonomic office chairs and standing desks " +
                "for 30 workstations in the new headquarters.",
                now.plusDays(21), "Open", 2L,
                new BigDecimal("45000.00"), 5L, 30);

        // ── RFQ 3: Closed – Stationery ────────────────────────────────────────
        RFQ rfq3 = createRFQ(
                "Annual Stationery Supply Contract",
                "Yearly supply of office stationery including paper, pens, folders, " +
                "and other consumables for all departments.",
                now.minusDays(5), "Closed", 3L,
                new BigDecimal("12000.00"), 3L, 1000);

        // ── RFQ 4: Awarded – Construction ────────────────────────────────────
        RFQ rfq4 = createRFQ(
                "Server Room Renovation",
                "Renovation of the main server room including raised flooring, " +
                "cooling system upgrade, and cable management.",
                now.minusDays(30), "Awarded", 2L,
                new BigDecimal("120000.00"), 2L, 1);

        // ── RFQ 5: Open – Electronics ─────────────────────────────────────────
        RFQ rfq5 = createRFQ(
                "Network Equipment Upgrade",
                "Supply of managed switches, routers, and access points for " +
                "the office network infrastructure upgrade.",
                now.plusDays(10), "Open", 3L,
                new BigDecimal("35000.00"), 4L, 20);

        // ── RFQ 6: Closed – Previous stationery contract (older, now closed with PO 5) ──
        RFQ rfq6 = createRFQ(
                "Stationery Supply Q1 2025",
                "Q1 2025 supply of office stationery including A4 paper, pens, folders, " +
                "and consumables. Previous contract now closed.",
                now.minusDays(65), "Closed", 3L,
                new BigDecimal("11000.00"), 3L, 900);

        // ── Bids for RFQ 1 (Open – Laptops) ──────────────────────────────────
        createBid(rfq1.getRfqId(), 1L, new BigDecimal("72000.00"), "Pending",
                now.minusDays(3),
                "We offer Dell XPS 15 laptops with 16GB RAM, 512GB NVMe SSD, Intel i7-12th Gen. " +
                "Includes 3-year on-site warranty and free setup.",
                10, new BigDecimal("88.0"), new BigDecimal("85.5"));

        createBid(rfq1.getRfqId(), 3L, new BigDecimal("68500.00"), "Pending",
                now.minusDays(2),
                "Lenovo ThinkPad X1 Carbon Gen 10 bundle. 16GB RAM, 512GB SSD, i7. " +
                "Competitive pricing with 2-year warranty.",
                14, new BigDecimal("82.0"), new BigDecimal("80.0"));

        // ── Bids for RFQ 2 (Open – Furniture) ────────────────────────────────
        createBid(rfq2.getRfqId(), 5L, new BigDecimal("42000.00"), "Pending",
                now.minusDays(4),
                "Herman Miller Aeron chairs and Uplift standing desks. " +
                "Professional installation included. 5-year warranty on all items.",
                21, new BigDecimal("92.0"), new BigDecimal("89.0"));

        // ── Bids for RFQ 3 (Closed – Stationery) ─────────────────────────────
        createBid(rfq3.getRfqId(), 3L, new BigDecimal("11200.00"), "Accepted",
                now.minusDays(20),
                "Comprehensive stationery package from top brands. " +
                "Monthly delivery schedule, dedicated account manager.",
                7, new BigDecimal("90.0"), new BigDecimal("88.5"));

        createBid(rfq3.getRfqId(), 1L, new BigDecimal("11800.00"), "Rejected",
                now.minusDays(18),
                "Full stationery supply with premium brands. Quarterly bulk delivery.",
                14, new BigDecimal("85.0"), new BigDecimal("82.0"));

        // ── Bids for RFQ 4 (Awarded – Construction) ───────────────────────────
        createBid(rfq4.getRfqId(), 2L, new BigDecimal("115000.00"), "Awarded",
                now.minusDays(45),
                "Complete server room renovation with certified engineers. " +
                "Includes raised flooring, precision cooling, and structured cabling. " +
                "ISO 9001 certified contractor.",
                45, new BigDecimal("95.0"), new BigDecimal("93.0"));

        createBid(rfq4.getRfqId(), 1L, new BigDecimal("118500.00"), "Rejected",
                now.minusDays(43),
                "Server room upgrade with premium materials. 60-day completion guarantee.",
                60, new BigDecimal("88.0"), new BigDecimal("85.0"));

        // ── Bids for RFQ 5 (Open – Network Equipment) ────────────────────────
        createBid(rfq5.getRfqId(), 4L, new BigDecimal("33000.00"), "Pending",
                now.minusDays(1),
                "Cisco Catalyst switches, Meraki access points, and Fortinet routers. " +
                "Full configuration and 1-year support included.",
                7, new BigDecimal("91.0"), new BigDecimal("88.0"));

        createBid(rfq5.getRfqId(), 1L, new BigDecimal("34500.00"), "Pending",
                now.minusHours(12),
                "HP Aruba networking stack with cloud management. " +
                "Lifetime firmware updates and 24/7 support.",
                10, new BigDecimal("89.0"), new BigDecimal("87.0"));

        // ── Bids for RFQ 6 (Closed – Previous Stationery Q1 2025) ────────────
        // Winning bid → PO 5 (Closed, $10,800, vendor 3)
        createBid(rfq6.getRfqId(), 3L, new BigDecimal("10800.00"), "Awarded",
                now.minusDays(75),
                "Complete Q1 stationery package: A4 paper, pens, folders, sticky notes. " +
                "Weekly delivery schedule. Dedicated account manager.",
                7, new BigDecimal("88.0"), new BigDecimal("86.5"));

        createBid(rfq6.getRfqId(), 1L, new BigDecimal("11500.00"), "Rejected",
                now.minusDays(73),
                "Premium stationery brands. Bi-weekly bulk delivery.",
                14, new BigDecimal("83.0"), new BigDecimal("81.0"));

        log.info("RFQs and Bids initialized");
    }

    private RFQ createRFQ(String title, String description, LocalDateTime deadline,
                           String status, Long createdBy, BigDecimal estimatedValue,
                           Long categoryId, Integer expectedQuantity) {
        RFQ rfq = new RFQ();
        rfq.setTitle(title);
        rfq.setDescription(description);
        rfq.setDeadline(deadline);
        rfq.setStatus(status);
        rfq.setCreatedBy(createdBy);
        rfq.setCreatedAt(deadline.minusDays(30));
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
