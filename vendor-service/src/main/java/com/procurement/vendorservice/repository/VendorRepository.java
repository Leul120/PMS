package com.procurement.vendorservice.repository;

import com.procurement.vendorservice.entity.Vendor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface VendorRepository extends JpaRepository<Vendor, Long>, JpaSpecificationExecutor<Vendor> {
    Optional<Vendor> findByEmail(String email);
    List<Vendor> findByComplianceStatus(String complianceStatus);
    Page<Vendor> findAll(Pageable pageable);
    List<Vendor> findByCategoryCategoryId(Long categoryId);
    boolean existsByEmail(String email);
    boolean existsByEmailAndTenantId(String email, Long tenantId);
    Optional<Vendor> findByUserId(Long userId);
    List<Vendor> findByTenantId(Long tenantId);
}
