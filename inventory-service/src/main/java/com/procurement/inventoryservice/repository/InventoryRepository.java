package com.procurement.inventoryservice.repository;

import com.procurement.inventoryservice.entity.InventoryItem;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface InventoryRepository extends JpaRepository<InventoryItem, Long> {
    Optional<InventoryItem> findByItemCode(String itemCode);
    List<InventoryItem> findByCategory(String category);
    List<InventoryItem> findByQuantityLessThanEqual(Integer threshold);
    Page<InventoryItem> findAll(Pageable pageable);
}
