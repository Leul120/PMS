package com.procurement.inventoryservice.service;

import com.procurement.inventoryservice.dto.InventoryFilterOptionsResponse;
import com.procurement.inventoryservice.dto.InventoryItemRequest;
import com.procurement.inventoryservice.dto.InventoryStatsResponse;
import com.procurement.inventoryservice.dto.InventoryStockStatus;
import com.procurement.inventoryservice.dto.PagedResponse;
import com.procurement.inventoryservice.entity.InventoryItem;
import com.procurement.inventoryservice.repository.InventoryRepository;
import com.procurement.inventoryservice.repository.InventorySpecifications;
import com.procurement.inventoryservice.tenant.TenantContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.kafka.annotation.DltHandler;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.kafka.annotation.RetryableTopic;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.retrytopic.TopicSuffixingStrategy;
import org.springframework.retry.annotation.Backoff;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class InventoryService {

    private final InventoryRepository inventoryRepository;
    private final KafkaTemplate<String, Object> kafkaTemplate;

    @Transactional(readOnly = true)
    public PagedResponse<InventoryItem> getAllItems(
            int page,
            int size,
            String search,
            String category,
            String location,
            InventoryStockStatus stockStatus,
            String sort) {
        Specification<InventoryItem> spec = InventorySpecifications.combine(
            search, category, location, stockStatus);
        Page<InventoryItem> p = inventoryRepository.findAll(
            spec,
            PageRequest.of(page, size, resolveSort(sort)));
        return PagedResponse.<InventoryItem>builder()
            .content(p.getContent()).page(p.getNumber()).size(p.getSize())
            .totalElements(p.getTotalElements()).totalPages(p.getTotalPages()).last(p.isLast()).build();
    }

    @Transactional(readOnly = true)
    public InventoryStatsResponse getStats() {
        Object[] row = inventoryRepository.aggregateStats();
        long productCount = row[0] != null ? ((Number) row[0]).longValue() : 0;
        long totalUnits = row[1] != null ? ((Number) row[1]).longValue() : 0;
        long outOfStock = row[2] != null ? ((Number) row[2]).longValue() : 0;
        long lowStock = row[3] != null ? ((Number) row[3]).longValue() : 0;
        long inStock = row[4] != null ? ((Number) row[4]).longValue() : 0;
        long overMax = row[5] != null ? ((Number) row[5]).longValue() : 0;
        return InventoryStatsResponse.builder()
            .productCount(productCount)
            .totalUnits(totalUnits)
            .inStock(inStock)
            .lowStock(lowStock)
            .outOfStock(outOfStock)
            .overMax(overMax)
            .build();
    }

    @Transactional(readOnly = true)
    public InventoryFilterOptionsResponse getFilterOptions() {
        return InventoryFilterOptionsResponse.builder()
            .categories(inventoryRepository.findDistinctCategories())
            .locations(inventoryRepository.findDistinctLocations())
            .build();
    }

    private Sort resolveSort(String sort) {
        if (sort == null || sort.isBlank()) {
            return Sort.by(Sort.Direction.ASC, "name");
        }
        return switch (sort) {
            case "name-desc" -> Sort.by(Sort.Direction.DESC, "name");
            case "qty-asc" -> Sort.by(Sort.Direction.ASC, "quantity");
            case "qty-desc" -> Sort.by(Sort.Direction.DESC, "quantity");
            case "sku-asc" -> Sort.by(Sort.Direction.ASC, "itemCode");
            case "updated-desc" -> Sort.by(Sort.Direction.DESC, "updatedAt");
            default -> Sort.by(Sort.Direction.ASC, "name");
        };
    }

    @Transactional(readOnly = true)
    public InventoryItem getItemById(Long id) {
        return inventoryRepository.findById(id)
            .orElseThrow(() -> new RuntimeException("Item not found: " + id));
    }

    @Transactional
    public InventoryItem createItem(InventoryItemRequest request) {
        if (inventoryRepository.findByItemCode(request.getItemCode()).isPresent()) {
            throw new RuntimeException("Item code already exists: " + request.getItemCode());
        }
        InventoryItem item = new InventoryItem();
        Long tenantId = TenantContext.getCurrentTenant();
        if (tenantId == null) {
            throw new IllegalStateException("Tenant context is required. Ensure request is authenticated.");
        }
        item.setTenantId(tenantId);
        item.setItemCode(request.getItemCode());
        item.setName(request.getName());
        item.setDescription(request.getDescription());
        item.setQuantity(request.getQuantity());
        item.setMinStock(request.getMinStock());
        item.setMaxStock(request.getMaxStock());
        item.setUnit(request.getUnit());
        item.setLocation(request.getLocation());
        item.setCategory(request.getCategory());
        return inventoryRepository.save(item);
    }

    @Transactional
    public InventoryItem updateItem(Long id, InventoryItemRequest request) {
        InventoryItem item = getItemById(id);
        item.setName(request.getName());
        item.setDescription(request.getDescription());
        item.setQuantity(request.getQuantity());
        item.setMinStock(request.getMinStock());
        item.setMaxStock(request.getMaxStock());
        item.setUnit(request.getUnit());
        item.setLocation(request.getLocation());
        item.setCategory(request.getCategory());
        return inventoryRepository.save(item);
    }

    @Transactional
    public void deleteItem(Long id) {
        inventoryRepository.delete(getItemById(id));
    }

    @Transactional
    public InventoryItem adjustStock(Long id, Integer quantityChange) {
        InventoryItem item = getItemById(id);
        int newQty = item.getQuantity() + quantityChange;
        if (newQty < 0) {
            throw new RuntimeException("Insufficient stock for item " + item.getItemCode() +
                ": current=" + item.getQuantity() + ", requested change=" + quantityChange);
        }
        item.setQuantity(newQty);
        InventoryItem saved = inventoryRepository.save(item);
        log.info("Stock adjusted for {}: {} → {}", item.getItemCode(), item.getQuantity(), newQty);
        checkLowStockAlert(saved);
        return saved;
    }

    @Transactional(readOnly = true)
    public List<InventoryItem> getLowStockItems() {
        return inventoryRepository.findLowStockItems();
    }

    /** Runs every hour and publishes a Kafka event for each low-stock item. */
    @Scheduled(fixedRateString = "${inventory.low-stock-check-ms:3600000}")
    @Transactional(readOnly = true)
    public void scheduledLowStockCheck() {
        List<InventoryItem> lowItems = inventoryRepository.findLowStockItems();
        if (lowItems.isEmpty()) return;
        log.info("Low stock check: {} item(s) need attention", lowItems.size());
        for (InventoryItem item : lowItems) {
            try {
                kafkaTemplate.send("inventory.low-stock", Map.of(
                    "itemId", item.getId(),
                    "itemCode", item.getItemCode(),
                    "name", item.getName(),
                    "quantity", item.getQuantity(),
                    "minStock", item.getMinStock(),
                    "status", item.getStatus()
                ));
            } catch (Exception e) {
                log.warn("Failed to publish low-stock event for {}: {}", item.getItemCode(), e.getMessage());
            }
        }
    }

    // ── Kafka listeners ───────────────────────────────────────────────────────

    /**
     * When a PO is approved, reserve the corresponding inventory quantity.
     * If the item doesn't exist in inventory, log a warning (no crash).
     */
    @RetryableTopic(
        attempts = "3",
        backoff = @Backoff(delay = 2000, multiplier = 2.0),
        topicSuffixingStrategy = TopicSuffixingStrategy.SUFFIX_WITH_INDEX_VALUE
    )
    @KafkaListener(topics = "po.approved", groupId = "inventory-service-group")
    @Transactional
    public void handlePOApproved(Map<String, Object> event) {
        Long poId = toLong(event.get("poId"));
        Long vendorId = toLong(event.get("vendorId"));
        log.info("PO approved event received: poId={}, vendorId={}", poId, vendorId);
        // Inventory reservation logic would go here once PO line items are available.
        // Currently POs don't carry item-level detail — this is a hook for future extension.
    }

    @RetryableTopic(
        attempts = "3",
        backoff = @Backoff(delay = 2000, multiplier = 2.0),
        topicSuffixingStrategy = TopicSuffixingStrategy.SUFFIX_WITH_INDEX_VALUE
    )
    @KafkaListener(topics = "delivery.completed", groupId = "inventory-service-group")
    @Transactional
    public void handleDeliveryCompleted(Map<String, Object> event) {
        Long deliveryId = toLong(event.get("deliveryId"));
        Long poId = toLong(event.get("poId"));
        Integer quantityDelivered = event.get("quantityDelivered") instanceof Number n
            ? n.intValue() : null;
        log.info("Delivery completed: deliveryId={}, poId={}, qty={}", deliveryId, poId, quantityDelivered);
        // When PO line items are linked to inventory item codes, adjust stock here.
        // Hook is in place for future extension.
    }

    @DltHandler
    public void handleDlt(Map<String, Object> event,
                          org.apache.kafka.clients.consumer.ConsumerRecord<?, ?> record) {
        log.error("Inventory DLT: exhausted retries. Topic={}, Event={}", record.topic(), event);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private void checkLowStockAlert(InventoryItem item) {
        if (item.getQuantity() <= item.getMinStock()) {
            String level = item.getQuantity() <= 0 ? "critical" : "low";
            log.warn("{} STOCK: {} ({}) has {} units (min: {})",
                level.toUpperCase(), item.getName(), item.getItemCode(), item.getQuantity(), item.getMinStock());
            try {
                java.util.HashMap<String, Object> payload = new java.util.HashMap<>();
                payload.put("itemId", item.getId());
                payload.put("itemCode", item.getItemCode());
                payload.put("name", item.getName());
                payload.put("quantity", item.getQuantity());
                payload.put("minStock", item.getMinStock());
                payload.put("status", level);
                payload.put("tenantId", item.getTenantId());
                kafkaTemplate.send("inventory.low-stock", payload);
            } catch (Exception e) {
                log.warn("Failed to publish low-stock event for {}: {}", item.getItemCode(), e.getMessage());
            }
        }
    }

    private Long toLong(Object value) {
        if (value == null) return null;
        if (value instanceof Number n) return n.longValue();
        try { return Long.parseLong(value.toString()); } catch (NumberFormatException e) { return null; }
    }
}


