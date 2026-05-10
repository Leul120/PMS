package com.procurement.vendorservice.service;

import com.procurement.vendorservice.infrastructure.lock.DistributedLock;
import com.procurement.vendorservice.entity.Vendor;
import com.procurement.vendorservice.repository.VendorRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

/**
 * Service demonstrating caching and distributed locking.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class CachedVendorService {

    private final VendorRepository vendorRepository;

    /**
     * Get vendor by ID with caching.
     */
    @Cacheable(value = "vendors", key = "'vendor-service:vendors:by-id:' + #vendorId", sync = true)
    @Transactional(readOnly = true)
    public Optional<Vendor> getVendorById(Long vendorId) {
        log.debug("Fetching vendor {} from database", vendorId);
        return vendorRepository.findById(vendorId);
    }

    /**
     * Get vendor by email with caching.
     */
    @Cacheable(value = "vendors", key = "'vendor-service:vendors:by-email:' + #email", sync = true)
    @Transactional(readOnly = true)
    public Optional<Vendor> getVendorByEmail(String email) {
        log.debug("Fetching vendor with email {} from database", email);
        return vendorRepository.findByEmail(email);
    }

    /**
     * Create vendor with distributed lock.
     */
    @DistributedLock(key = "'vendor:create:' + #vendor.email", waitTime = 5, leaseTime = 30)
    @Transactional
    public Vendor createVendor(Vendor vendor) {
        log.info("Creating vendor with email: {}", vendor.getEmail());

        if (vendorRepository.existsByEmail(vendor.getEmail())) {
            throw new IllegalStateException("Vendor email already exists: " + vendor.getEmail());
        }

        return vendorRepository.save(vendor);
    }

    /**
     * Update vendor with lock and cache eviction.
     */
    @DistributedLock(key = "'vendor:update:' + #vendorId", waitTime = 10, leaseTime = 30)
    @CacheEvict(value = "vendors", key = "'vendor-service:vendors:by-id:' + #vendorId")
    @Transactional
    public Vendor updateVendor(Long vendorId, Vendor vendor) {
        log.info("Updating vendor {} with lock", vendorId);

        Vendor existing = vendorRepository.findById(vendorId)
                .orElseThrow(() -> new IllegalArgumentException("Vendor not found: " + vendorId));

        existing.setCompanyName(vendor.getCompanyName());
        existing.setEmail(vendor.getEmail());
        existing.setPhoneNumber(vendor.getPhoneNumber());
        existing.setAddress(vendor.getAddress());

        return vendorRepository.save(existing);
    }

    /**
     * Get vendors by compliance status with caching.
     */
    @Cacheable(value = "vendors", key = "'vendor-service:vendors:by-status:' + #status", sync = true)
    @Transactional(readOnly = true)
    public List<Vendor> getVendorsByComplianceStatus(String status) {
        log.debug("Fetching vendors by compliance status: {}", status);
        return vendorRepository.findByComplianceStatus(status);
    }

    /**
     * Delete vendor with lock and cache eviction.
     */
    @DistributedLock(key = "'vendor:delete:' + #vendorId", waitTime = 5, leaseTime = 15)
    @CacheEvict(value = "vendors", key = "'vendor-service:vendors:by-id:' + #vendorId")
    @Transactional
    public void deleteVendor(Long vendorId) {
        log.info("Deleting vendor {} with lock", vendorId);

        Vendor vendor = vendorRepository.findById(vendorId)
                .orElseThrow(() -> new IllegalArgumentException("Vendor not found: " + vendorId));

        vendorRepository.delete(vendor);
    }
}
