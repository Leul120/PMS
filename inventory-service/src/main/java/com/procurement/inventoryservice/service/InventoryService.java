package com.procurement.inventoryservice.service;

import com.procurement.inventoryservice.entity.InventoryItem;
import com.procurement.inventoryservice.repository.InventoryRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class InventoryService {
    
    private final InventoryRepository inventoryRepository;
    
    public List<InventoryItem> getAllItems() {
        return inventoryRepository.findAll();
    }
    
    public InventoryItem getItemById(Long id) {
        return inventoryRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Item not found"));
    }
    
    @Transactional
    public InventoryItem createItem(InventoryItem item) {
        if (inventoryRepository.findByItemCode(item.getItemCode()).isPresent()) {
            throw new RuntimeException("Item code already exists");
        }
        return inventoryRepository.save(item);
    }
    
    @Transactional
    public InventoryItem updateItem(Long id, InventoryItem itemDetails) {
        InventoryItem item = getItemById(id);
        item.setName(itemDetails.getName());
        item.setDescription(itemDetails.getDescription());
        item.setQuantity(itemDetails.getQuantity());
        item.setMinStock(itemDetails.getMinStock());
        item.setMaxStock(itemDetails.getMaxStock());
        item.setUnit(itemDetails.getUnit());
        item.setLocation(itemDetails.getLocation());
        item.setCategory(itemDetails.getCategory());
        return inventoryRepository.save(item);
    }
    
    @Transactional
    public void deleteItem(Long id) {
        InventoryItem item = getItemById(id);
        inventoryRepository.delete(item);
    }
    
    @Transactional
    public InventoryItem adjustStock(Long id, Integer quantityChange) {
        InventoryItem item = getItemById(id);
        item.setQuantity(item.getQuantity() + quantityChange);
        return inventoryRepository.save(item);
    }
    
    public List<InventoryItem> getLowStockItems() {
        return inventoryRepository.findAll().stream()
                .filter(item -> item.getQuantity() <= item.getMinStock())
                .toList();
    }
}
