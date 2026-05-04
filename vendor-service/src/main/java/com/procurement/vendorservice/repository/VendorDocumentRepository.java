package com.procurement.vendorservice.repository;

import com.procurement.vendorservice.entity.VendorDocument;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;

@Repository
public interface VendorDocumentRepository extends JpaRepository<VendorDocument, Long> {
    List<VendorDocument> findByVendorVendorId(Long vendorId);
    List<VendorDocument> findByStatus(String status);
    List<VendorDocument> findByExpiryDateBefore(LocalDate date);
    List<VendorDocument> findByVendorVendorIdAndDocumentType(Long vendorId, String documentType);
}
