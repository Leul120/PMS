package com.procurement.vendorservice.repository;

import com.procurement.vendorservice.entity.VendorCategory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface VendorCategoryRepository extends JpaRepository<VendorCategory, Long> {
    Optional<VendorCategory> findByCategoryName(String categoryName);
}
