package com.procurement.deliveryinvoiceservice.repository;

import com.procurement.deliveryinvoiceservice.entity.Invoice;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.util.List;

public interface InvoiceRepository extends JpaRepository<Invoice, Long>, JpaSpecificationExecutor<Invoice> {
    List<Invoice> findByPoId(Long poId);
    List<Invoice> findByVendorId(Long vendorId);
    Page<Invoice> findAll(Pageable pageable);
}
