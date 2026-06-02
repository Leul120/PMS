package com.procurement.vendorservice.service;

import com.procurement.vendorservice.dto.VendorRequest;
import com.procurement.vendorservice.entity.Vendor;
import com.procurement.vendorservice.entity.VendorCategory;
import com.procurement.vendorservice.repository.VendorCategoryRepository;
import com.procurement.vendorservice.repository.VendorDocumentRepository;
import com.procurement.vendorservice.repository.VendorRepository;
import com.procurement.vendorservice.tenant.TenantContext;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.kafka.core.KafkaTemplate;

import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class VendorServiceTest {

    @Mock private VendorRepository vendorRepository;
    @Mock private VendorCategoryRepository categoryRepository;
    @Mock private VendorDocumentRepository documentRepository;
    @Mock private KafkaTemplate<String, Object> kafkaTemplate;

    @InjectMocks private VendorService vendorService;

    private VendorCategory category;

    @BeforeEach
    void setUp() {
        category = new VendorCategory(1L, "IT Services", "IT related vendors");
        TenantContext.clear();
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    // ─── registerVendor ───────────────────────────────────────────────────────────

    @Test
    void registerVendor_setsTenantIdFromContext() {
        TenantContext.setCurrentTenant(5L);
        VendorRequest req = buildRequest("tech@corp.com");
        when(vendorRepository.existsByEmail("tech@corp.com")).thenReturn(false);
        when(categoryRepository.findById(1L)).thenReturn(Optional.of(category));
        ArgumentCaptor<Vendor> captor = ArgumentCaptor.forClass(Vendor.class);
        when(vendorRepository.save(captor.capture())).thenAnswer(inv -> {
            Vendor v = inv.getArgument(0);
            v.setVendorId(100L);
            return v;
        });

        vendorService.registerVendor(req, 1L);

        assertThat(captor.getValue().getTenantId()).isEqualTo(5L);
    }

    @Test
    void registerVendor_nullTenantContext_savesNullTenantId() {
        VendorRequest req = buildRequest("vendor@test.com");
        when(vendorRepository.existsByEmail("vendor@test.com")).thenReturn(false);
        when(categoryRepository.findById(1L)).thenReturn(Optional.of(category));
        ArgumentCaptor<Vendor> captor = ArgumentCaptor.forClass(Vendor.class);
        when(vendorRepository.save(captor.capture())).thenAnswer(inv -> {
            Vendor v = inv.getArgument(0);
            v.setVendorId(101L);
            return v;
        });

        vendorService.registerVendor(req, 1L);

        assertThat(captor.getValue().getTenantId()).isNull();
    }

    @Test
    void registerVendor_duplicateEmail_throws() {
        VendorRequest req = buildRequest("existing@corp.com");
        when(vendorRepository.existsByEmail("existing@corp.com")).thenReturn(true);

        assertThatThrownBy(() -> vendorService.registerVendor(req, 1L))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("already exists");

        verify(vendorRepository, never()).save(any());
    }

    @Test
    void registerVendor_categoryNotFound_throws() {
        VendorRequest req = buildRequest("new@corp.com");
        when(vendorRepository.existsByEmail("new@corp.com")).thenReturn(false);
        when(categoryRepository.findById(1L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> vendorService.registerVendor(req, 1L))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("Category not found");

        verify(vendorRepository, never()).save(any());
    }

    @Test
    void registerVendor_differentTenants_separateTenantIds() {
        VendorRequest req1 = buildRequest("v1@a.com");
        VendorRequest req2 = buildRequest("v2@b.com");

        when(vendorRepository.existsByEmail(anyString())).thenReturn(false);
        when(categoryRepository.findById(1L)).thenReturn(Optional.of(category));

        ArgumentCaptor<Vendor> captor = ArgumentCaptor.forClass(Vendor.class);
        when(vendorRepository.save(captor.capture())).thenAnswer(inv -> {
            Vendor v = inv.getArgument(0);
            v.setVendorId(1L);
            return v;
        });

        TenantContext.setCurrentTenant(10L);
        vendorService.registerVendor(req1, 1L);
        Long tenant1 = captor.getValue().getTenantId();

        TenantContext.setCurrentTenant(20L);
        vendorService.registerVendor(req2, 2L);
        Long tenant2 = captor.getValue().getTenantId();

        assertThat(tenant1).isEqualTo(10L);
        assertThat(tenant2).isEqualTo(20L);
    }

    @Test
    void getVendor_notFound_throws() {
        when(vendorRepository.findById(999L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> vendorService.getVendor(999L))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("Vendor not found");
    }

    // ─── helpers ─────────────────────────────────────────────────────────────────

    private VendorRequest buildRequest(String email) {
        VendorRequest req = new VendorRequest();
        req.setCompanyName("Test Corp");
        req.setContactPerson("Jane Doe");
        req.setEmail(email);
        req.setCategoryId(1L);
        req.setPhoneNumber("555-0000");
        req.setAddress("123 Main St");
        req.setTaxId("TX-001");
        return req;
    }
}
