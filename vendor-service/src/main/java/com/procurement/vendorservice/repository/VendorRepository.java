package com.procurement.vendorservice.repository;

import com.procurement.vendorservice.entity.Vendor;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface VendorRepository extends JpaRepository<Vendor, Long> {
    Optional<Vendor> findByEmail(String email);
    List<Vendor> findByComplianceStatus(String complianceStatus);
    List<Vendor> findByCategoryCategoryId(Long categoryId);
    boolean existsByEmail(String email);
    Optional<Vendor> findByUserId(Long userId);
}
