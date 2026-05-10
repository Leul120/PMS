package com.procurement.procurementservice.repository;

import com.procurement.procurementservice.entity.PurchaseOrder;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface PurchaseOrderRepository extends JpaRepository<PurchaseOrder, Long> {
    List<PurchaseOrder> findByStatus(String status);
    List<PurchaseOrder> findByVendorId(Long vendorId);
    List<PurchaseOrder> findByCreatedBy(Long createdBy);
    Page<PurchaseOrder> findAll(Pageable pageable);
}
