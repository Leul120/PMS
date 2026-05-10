package com.procurement.inventoryservice.controller;

import com.procurement.inventoryservice.dto.PagedResponse;
import com.procurement.inventoryservice.entity.InventoryItem;
import com.procurement.inventoryservice.service.InventoryService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/inventory")
@RequiredArgsConstructor
public class InventoryController {
    
    private final InventoryService inventoryService;
    
    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'OFFICER', 'MANAGER', 'AUDITOR')")
    public ResponseEntity<PagedResponse<InventoryItem>> getAllItems(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {
        return ResponseEntity.ok(inventoryService.getAllItems(page, size));
    }
    
    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'OFFICER', 'MANAGER', 'AUDITOR')")
    public ResponseEntity<InventoryItem> getItemById(@PathVariable Long id) {
        return ResponseEntity.ok(inventoryService.getItemById(id));
    }
    
    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'OFFICER')")
    public ResponseEntity<InventoryItem> createItem(@Valid @RequestBody InventoryItem item) {
        return ResponseEntity.ok(inventoryService.createItem(item));
    }
    
    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'OFFICER')")
    public ResponseEntity<InventoryItem> updateItem(@PathVariable Long id, @Valid @RequestBody InventoryItem item) {
        return ResponseEntity.ok(inventoryService.updateItem(id, item));
    }
    
    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> deleteItem(@PathVariable Long id) {
        inventoryService.deleteItem(id);
        return ResponseEntity.ok().build();
    }
    
    @PostMapping("/{id}/adjust")
    @PreAuthorize("hasAnyRole('ADMIN', 'OFFICER')")
    public ResponseEntity<InventoryItem> adjustStock(@PathVariable Long id, @RequestBody Map<String, Integer> request) {
        Integer quantityChange = request.get("quantityChange");
        return ResponseEntity.ok(inventoryService.adjustStock(id, quantityChange));
    }
    
    @GetMapping("/low-stock")
    @PreAuthorize("hasAnyRole('ADMIN', 'OFFICER', 'MANAGER')")
    public ResponseEntity<List<InventoryItem>> getLowStockItems() {
        return ResponseEntity.ok(inventoryService.getLowStockItems());
    }
}
