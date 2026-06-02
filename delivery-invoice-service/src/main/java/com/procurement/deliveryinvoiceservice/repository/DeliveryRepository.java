package com.procurement.deliveryinvoiceservice.repository;

import com.procurement.deliveryinvoiceservice.entity.Delivery;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.util.List;

public interface DeliveryRepository extends JpaRepository<Delivery, Long>, JpaSpecificationExecutor<Delivery> {
    List<Delivery> findByPoId(Long poId);
    Page<Delivery> findAll(Pageable pageable);
}
