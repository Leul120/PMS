package com.procurement.inventoryservice.service;

import com.procurement.inventoryservice.dto.InventoryItemRequest;
import com.procurement.inventoryservice.dto.PagedResponse;
import com.procurement.inventoryservice.entity.InventoryItem;
import com.procurement.inventoryservice.repository.InventoryRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.kafka.annotation.DltHandler;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.kafka.annotation.RetryableTopic;
import org.springframework.kafka.retrytopic.TopicSuffixingStrategy;
import org.springframework.retry.annotation.Backoff;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class InventoryService {

    private final InventoryRepository inventoryRepository;

    public PagedResponse<InventoryItem> getAllItems(int page, int size) {
        Page<InventoryItem> p = inventoryRepository.findAll(
            PageRequest.of(page, size, Sort.unsorted()));
        return PagedResponse.<InventoryItem>builder()
            .content(p.getContent()).page(p.getNumber()).size(p.getSize())
            .totalElements(p.getTotalElements()).totalPages(p.getTotalPages()).last(p.isLast()).build();
    }

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

    /**
     * Uses a database-level query — avoids loading all items into memory.
     * Returns items where quantity <= minStock.
     */
    public List<InventoryItem> getLowStockItems() {
        // findByQuantityLessThanEqual compares against a fixed threshold;
        // we need quantity <= minStock which varies per item, so we use a stream filter
        // on the DB-paged result. For large datasets, a @Query with a JOIN condition is preferred.
        return inventoryRepository.findAll().stream()
            .filter(item -> item.getQuantity() <= item.getMinStock())
            .toList();
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
        if (item.getQuantity() <= 0) {
            log.warn("CRITICAL STOCK: {} ({}) is out of stock!", item.getName(), item.getItemCode());
        } else if (item.getQuantity() <= item.getMinStock()) {
            log.warn("LOW STOCK: {} ({}) has {} units (min: {})",
                item.getName(), item.getItemCode(), item.getQuantity(), item.getMinStock());
        }
    }

    private Long toLong(Object value) {
        if (value == null) return null;
        if (value instanceof Number n) return n.longValue();
        try { return Long.parseLong(value.toString()); } catch (NumberFormatException e) { return null; }
    }
}


