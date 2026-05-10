package com.procurement.deliveryinvoiceservice.repository;

import com.procurement.deliveryinvoiceservice.entity.Invoice;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface InvoiceRepository extends JpaRepository<Invoice, Long> {
    List<Invoice> findByPoId(Long poId);
    Page<Invoice> findAll(Pageable pageable);
}
