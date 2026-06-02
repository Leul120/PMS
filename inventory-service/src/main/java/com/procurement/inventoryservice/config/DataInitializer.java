package com.procurement.inventoryservice.config;

import com.procurement.inventoryservice.entity.InventoryItem;
import com.procurement.inventoryservice.repository.InventoryRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

/**
 * Seed data — inventory items reflect the actual procurement flow:
 *
 *   PO 1 → Server Room Renovation (BuildRight) → construction materials consumed on-site
 *   PO 2 → Stationery (OfficeEssentials, in transit) → stock not yet received
 *   PO 3 → Office Furniture (FurniturePlus, pending approval) → not yet ordered
 *   PO 4 → Laptops (TechSupply, draft) → not yet ordered
 *   PO 5 → Stationery (OfficeEssentials, closed) → 810 reams received, now in stock
 *
 * Stock levels show realistic states:
 *   - Items replenished by PO 5 delivery: normal stock
 *   - Items pending delivery (PO 2, 3, 4): low or critical stock (why the POs were raised)
 *   - Construction materials: consumed by PO 1 project, now depleted
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class DataInitializer implements CommandLineRunner {

    private final InventoryRepository inventoryRepository;

    @Override
    public void run(String... args) {
        if (inventoryRepository.count() > 0) {
            log.info("DataInitializer: inventory items already exist, skipping.");
            return;
        }
        seedInventoryItems();
        log.info("DataInitializer: inventory-service seed data loaded.");
    }

    private void seedInventoryItems() {

        // ── IT Equipment ──────────────────────────────────────────────────────
        // Laptops: PO 4 (Approved) was raised because stock is critically low
        save("IT-001", "Laptop - Dell XPS 15",
                "16GB RAM, 512GB SSD, Intel i7 — engineering department standard. " +
                "Replenishment approved via PO #4 (TechSupply, $72,000), delivery expected in 14 days.",
                2, 10, 60, "units", "Warehouse A - Shelf 1", "IT Equipment");  // CRITICAL → triggered PR-2025-001 → PO 4 Approved

        // Accessories: adequate stock
        save("IT-002", "Wireless Mouse",
                "Logitech MX Master 3 wireless mouse",
                45, 10, 80, "units", "Warehouse A - Shelf 2", "IT Equipment");

        save("IT-003", "USB-C Hub",
                "7-in-1 USB-C hub with HDMI and ethernet",
                38, 10, 80, "units", "Warehouse A - Shelf 2", "IT Equipment");

        save("IT-004", "Monitor - 27 inch 4K",
                "LG 27UK850 4K UHD monitor",
                8, 5, 30, "units", "Warehouse A - Shelf 3", "IT Equipment");  // LOW

        save("IT-005", "Mechanical Keyboard",
                "Cherry MX Blue mechanical keyboard",
                22, 10, 60, "units", "Warehouse A - Shelf 3", "IT Equipment");

        // ── Office Supplies ───────────────────────────────────────────────────
        // A4 Paper: PO 5 (Closed) delivered 810 reams → now in stock
        save("OS-001", "A4 Paper Ream",
                "80gsm white A4 paper, 500 sheets per ream — restocked via PO #5 (810 reams received)",
                810, 100, 1200, "reams", "Warehouse B - Shelf 1", "Office Supplies");  // NORMAL after PO 5 delivery

        // Pens: PO 2 (Dispatched) includes pens — stock currently low, replenishment in transit
        save("OS-002", "Ballpoint Pens (Box)",
                "Blue ballpoint pens, box of 50 — replenishment in transit via PO #2",
                6, 10, 100, "boxes", "Warehouse B - Shelf 1", "Office Supplies");  // LOW → PO 2 in transit

        save("OS-003", "Stapler",
                "Heavy-duty desktop stapler",
                18, 5, 40, "units", "Warehouse B - Shelf 2", "Office Supplies");

        // Sticky Notes: PO 2 includes sticky notes — stock critical, replenishment in transit
        save("OS-004", "Sticky Notes Pack",
                "3x3 inch sticky notes, 12 pads per pack — replenishment in transit via PO #2",
                0, 10, 80, "packs", "Warehouse B - Shelf 2", "Office Supplies");  // CRITICAL → PO 2 in transit

        // File Folders: PO 2 includes folders — low stock
        save("OS-005", "File Folders (Box)",
                "A4 manila file folders, box of 100 — replenishment in transit via PO #2",
                4, 10, 60, "boxes", "Warehouse B - Shelf 3", "Office Supplies");  // LOW → PO 2 in transit

        save("OS-006", "Whiteboard Markers Set",
                "Assorted colour dry-erase markers, set of 8",
                30, 10, 80, "sets", "Warehouse B - Shelf 3", "Office Supplies");

        // ── Furniture ─────────────────────────────────────────────────────────
        // Ergonomic chairs: PO 3 (Pending Approval) was raised because stock is low
        save("FN-001", "Ergonomic Office Chair",
                "Mesh back ergonomic chair with lumbar support — replenishment pending PO #3 approval",
                3, 5, 40, "units", "Warehouse C - Bay 1", "Furniture");  // LOW → PO 3 pending approval

        // Standing desks: PO 3 includes standing desks — critically low
        save("FN-002", "Standing Desk",
                "Height-adjustable sit-stand desk 140x70cm — replenishment pending PO #3 approval",
                0, 5, 30, "units", "Warehouse C - Bay 1", "Furniture");  // CRITICAL → PO 3 pending approval

        save("FN-003", "3-Drawer Pedestal",
                "Mobile under-desk pedestal with lock",
                20, 5, 40, "units", "Warehouse C - Bay 2", "Furniture");

        save("FN-004", "Bookshelf - 5 Tier",
                "Wooden 5-tier bookshelf 180cm tall",
                7, 3, 20, "units", "Warehouse C - Bay 2", "Furniture");

        save("FN-005", "Conference Table",
                "10-seat oval conference table 300x120cm",
                2, 2, 10, "units", "Warehouse C - Bay 3", "Furniture");

        // ── Construction Materials ────────────────────────────────────────────
        // These were consumed by PO 1 (Server Room Renovation, BuildRight) — now depleted
        save("CM-001", "Raised Floor Tile 600x600mm",
                "Anti-static raised floor tile — consumed by PO #1 server room renovation",
                0, 20, 200, "tiles", "Warehouse D - Bay 1", "Construction Materials");  // CRITICAL (consumed)

        save("CM-002", "Cable Management Tray",
                "1m steel cable management tray — consumed by PO #1 server room renovation",
                0, 10, 100, "units", "Warehouse D - Bay 1", "Construction Materials");  // CRITICAL (consumed)

        save("CM-003", "Portland Cement (Bag)",
                "50kg Portland cement bag — general stock",
                85, 30, 300, "bags", "Warehouse D - Bay 2", "Construction Materials");

        save("CM-004", "Plywood Sheet 18mm",
                "2440x1220mm 18mm structural plywood",
                40, 15, 100, "sheets", "Warehouse D - Bay 2", "Construction Materials");

        save("CM-005", "Paint - White Emulsion (20L)",
                "Interior white emulsion paint 20L bucket",
                22, 10, 60, "buckets", "Warehouse D - Bay 3", "Construction Materials");

        // ── Electronics ───────────────────────────────────────────────────────
        // Network equipment: PR-2025-003 (Pending Approval) was raised because stock is low
        save("EL-001", "Network Switch 24-Port",
                "Cisco Catalyst 9200 24-port managed switch — replenishment pending PR-2025-003 approval",
                1, 3, 15, "units", "Warehouse E - Shelf 1", "Electronics");  // LOW → PR-2025-003 pending

        save("EL-002", "Wireless Access Point",
                "Cisco Meraki MR46 — replenishment pending PR-2025-003 approval",
                2, 5, 20, "units", "Warehouse E - Shelf 1", "Electronics");  // LOW → PR-2025-003 pending

        save("EL-003", "Router - Enterprise",
                "Fortinet FortiGate 100F — replenishment pending PR-2025-003 approval",
                0, 2, 6, "units", "Warehouse E - Shelf 2", "Electronics");  // CRITICAL → PR-2025-003 pending

        save("EL-004", "UPS 1500VA",
                "APC 1500VA line-interactive UPS",
                9, 3, 20, "units", "Warehouse E - Shelf 2", "Electronics");

        save("EL-005", "HDMI Cable 2m",
                "High-speed HDMI 2.0 cable 2m",
                75, 20, 150, "units", "Warehouse E - Shelf 3", "Electronics");

        save("EL-006", "CAT6 Cable (Box 305m)",
                "CAT6 UTP cable, 305m pull box",
                3, 5, 25, "boxes", "Warehouse E - Shelf 3", "Electronics");  // LOW

        log.info("Seeded 26 inventory items across 5 categories.");
    }

    private void save(String code, String name, String description, int qty, int min, int max,
                      String unit, String location, String category) {
        InventoryItem item = new InventoryItem();
        item.setTenantId(1L);
        item.setItemCode(code);
        item.setName(name);
        item.setDescription(description);
        item.setQuantity(qty);
        item.setMinStock(min);
        item.setMaxStock(max);
        item.setUnit(unit);
        item.setLocation(location);
        item.setCategory(category);
        inventoryRepository.save(item);
    }
}
