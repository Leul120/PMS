package com.procurement.inventoryservice.controller;

import com.procurement.inventoryservice.dto.InventoryFilterOptionsResponse;
import com.procurement.inventoryservice.dto.InventoryItemRequest;
import com.procurement.inventoryservice.dto.InventoryStatsResponse;
import com.procurement.inventoryservice.dto.InventoryStockStatus;
import com.procurement.inventoryservice.dto.PagedResponse;
import com.procurement.inventoryservice.entity.InventoryItem;
import com.procurement.inventoryservice.service.InventoryService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/inventory")
@RequiredArgsConstructor
public class InventoryController {

    private final InventoryService inventoryService;

    @GetMapping
    public ResponseEntity<PagedResponse<InventoryItem>> getAllItems(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String location,
            @RequestParam(required = false, defaultValue = "ALL") InventoryStockStatus stockStatus,
            @RequestParam(required = false, defaultValue = "name-asc") String sort) {
        return ResponseEntity.ok(
            inventoryService.getAllItems(page, size, search, category, location, stockStatus, sort));
    }

    @GetMapping("/stats")
    public ResponseEntity<InventoryStatsResponse> getStats() {
        return ResponseEntity.ok(inventoryService.getStats());
    }

    @GetMapping("/filter-options")
    public ResponseEntity<InventoryFilterOptionsResponse> getFilterOptions() {
        return ResponseEntity.ok(inventoryService.getFilterOptions());
    }

    @GetMapping("/{id}")
    public ResponseEntity<InventoryItem> getItemById(@PathVariable Long id) {
        return ResponseEntity.ok(inventoryService.getItemById(id));
    }

    @PostMapping
    public ResponseEntity<InventoryItem> createItem(@Valid @RequestBody InventoryItemRequest request) {
        return ResponseEntity.ok(inventoryService.createItem(request));
    }

    @PutMapping("/{id}")
    public ResponseEntity<InventoryItem> updateItem(
            @PathVariable Long id,
            @Valid @RequestBody InventoryItemRequest request) {
        return ResponseEntity.ok(inventoryService.updateItem(id, request));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteItem(@PathVariable Long id) {
        inventoryService.deleteItem(id);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/{id}/adjust")
    public ResponseEntity<InventoryItem> adjustStock(
            @PathVariable Long id,
            @RequestBody Map<String, Integer> request) {
        Integer quantityChange = request.get("quantityChange");
        if (quantityChange == null) {
            return ResponseEntity.badRequest().build();
        }
        return ResponseEntity.ok(inventoryService.adjustStock(id, quantityChange));
    }

    @GetMapping("/low-stock")
    public ResponseEntity<List<InventoryItem>> getLowStockItems() {
        return ResponseEntity.ok(inventoryService.getLowStockItems());
    }
}
