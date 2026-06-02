package com.procurement.authservice.controller;

import com.procurement.authservice.dto.TenantRequest;
import com.procurement.authservice.dto.TenantResponse;
import com.procurement.authservice.service.TenantService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/tenants")
@RequiredArgsConstructor
public class TenantController {

    private final TenantService tenantService;

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN')")
    public ResponseEntity<TenantResponse> createTenant(@Valid @RequestBody TenantRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(tenantService.createTenant(request));
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN')")
    public ResponseEntity<List<TenantResponse>> getAllTenants() {
        return ResponseEntity.ok(tenantService.getAllTenants());
    }

    @GetMapping("/{tenantId}")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN')")
    public ResponseEntity<TenantResponse> getTenant(@PathVariable Long tenantId) {
        return ResponseEntity.ok(tenantService.getTenant(tenantId));
    }

    @GetMapping("/domain/{domain}")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN')")
    public ResponseEntity<TenantResponse> getTenantByDomain(@PathVariable String domain) {
        return ResponseEntity.ok(tenantService.getTenantByDomain(domain));
    }

    @PutMapping("/{tenantId}")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN')")
    public ResponseEntity<TenantResponse> updateTenant(@PathVariable Long tenantId,
                                                        @Valid @RequestBody TenantRequest request) {
        return ResponseEntity.ok(tenantService.updateTenant(tenantId, request));
    }

    @PostMapping("/{tenantId}/suspend")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN')")
    public ResponseEntity<TenantResponse> suspendTenant(@PathVariable Long tenantId) {
        return ResponseEntity.ok(tenantService.suspendTenant(tenantId));
    }

    @PostMapping("/{tenantId}/activate")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN')")
    public ResponseEntity<TenantResponse> activateTenant(@PathVariable Long tenantId) {
        return ResponseEntity.ok(tenantService.activateTenant(tenantId));
    }

    @DeleteMapping("/{tenantId}")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN')")
    public ResponseEntity<Void> deleteTenant(@PathVariable Long tenantId) {
        tenantService.deleteTenant(tenantId);
        return ResponseEntity.noContent().build();
    }
}
