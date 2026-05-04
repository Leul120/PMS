package com.procurement.vendorservice.config;

import com.procurement.vendorservice.entity.VendorCategory;
import com.procurement.vendorservice.repository.VendorCategoryRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
public class DataInitializer implements CommandLineRunner {
    
    private final VendorCategoryRepository categoryRepository;
    
    @Override
    public void run(String... args) {
        if (categoryRepository.count() == 0) {
            createCategory(1L, "IT", "Information Technology products and services");
            createCategory(2L, "Construction", "Construction materials and services");
            createCategory(3L, "Stationery", "Office supplies and stationery");
            createCategory(4L, "Electronics", "Electronic devices and components");
            createCategory(5L, "Furniture", "Office and home furniture");
            log.info("Vendor categories initialized");
        }
    }
    
    private void createCategory(Long id, String name, String description) {
        VendorCategory category = new VendorCategory();
        category.setCategoryId(id);
        category.setCategoryName(name);
        category.setDescription(description);
        categoryRepository.save(category);
    }
}
