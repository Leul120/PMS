package com.procurement.inventoryservice.repository;

import com.procurement.inventoryservice.entity.InventoryItem;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface InventoryRepository extends JpaRepository<InventoryItem, Long>, JpaSpecificationExecutor<InventoryItem> {
    Optional<InventoryItem> findByItemCode(String itemCode);
    List<InventoryItem> findByCategory(String category);
    List<InventoryItem> findByQuantityLessThanEqual(Integer threshold);
    Page<InventoryItem> findAll(Pageable pageable);

    /** Returns all items where current quantity is at or below their individual minimum stock level. */
    @Query("SELECT i FROM InventoryItem i WHERE i.quantity <= i.minStock")
    List<InventoryItem> findLowStockItems();

    @Query("SELECT DISTINCT i.category FROM InventoryItem i WHERE i.category IS NOT NULL AND TRIM(i.category) <> '' ORDER BY i.category")
    List<String> findDistinctCategories();

    @Query("SELECT DISTINCT i.location FROM InventoryItem i WHERE i.location IS NOT NULL AND TRIM(i.location) <> '' ORDER BY i.location")
    List<String> findDistinctLocations();

    @Query("""
        SELECT
            COUNT(i),
            COALESCE(SUM(i.quantity), 0),
            SUM(CASE WHEN i.quantity = 0 THEN 1 ELSE 0 END),
            SUM(CASE WHEN i.quantity > 0 AND i.quantity <= i.minStock THEN 1 ELSE 0 END),
            SUM(CASE WHEN i.quantity > i.minStock AND i.quantity <= i.maxStock THEN 1 ELSE 0 END),
            SUM(CASE WHEN i.quantity > i.minStock AND i.quantity > i.maxStock THEN 1 ELSE 0 END)
        FROM InventoryItem i
        """)
    Object[] aggregateStats();
}
