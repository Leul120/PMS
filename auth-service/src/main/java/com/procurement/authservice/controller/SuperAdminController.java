package com.procurement.authservice.controller;

import com.procurement.authservice.dto.*;
import com.procurement.authservice.service.AuthService;
import com.procurement.authservice.service.TenantService;
import com.procurement.authservice.service.UserManagementService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * SUPER_ADMIN only — cross-tenant operations.
 * All endpoints under /api/super-admin/** require ROLE_SUPER_ADMIN (enforced in SecurityConfig).
 * The TenantAspect skips the Hibernate tenant filter for SUPER_ADMIN so queries return all-tenant data.
 */
@RestController
@RequestMapping("/api/super-admin")
@RequiredArgsConstructor
public class SuperAdminController {

    private final TenantService tenantService;
    private final UserManagementService userManagementService;
    private final AuthService authService;

    // ─── Tenant management ────────────────────────────────────────────────────

    @GetMapping("/tenants")
    public ResponseEntity<PagedResponse<TenantResponse>> getAllTenants(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String status,
            @RequestParam(required = false, defaultValue = "name-asc") String sort) {
        return ResponseEntity.ok(tenantService.getTenants(page, size, search, status, sort));
    }

    @GetMapping("/tenants/stats")
    public ResponseEntity<TenantStatsResponse> getTenantStats() {
        return ResponseEntity.ok(tenantService.getTenantStats());
    }

    @PostMapping("/tenants")
    public ResponseEntity<TenantResponse> createTenant(@Valid @RequestBody TenantRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(tenantService.createTenant(request));
    }

    @GetMapping("/tenants/{tenantId}")
    public ResponseEntity<TenantResponse> getTenant(@PathVariable Long tenantId) {
        return ResponseEntity.ok(tenantService.getTenant(tenantId));
    }

    @PutMapping("/tenants/{tenantId}")
    public ResponseEntity<TenantResponse> updateTenant(@PathVariable Long tenantId,
                                                        @Valid @RequestBody TenantRequest request) {
        return ResponseEntity.ok(tenantService.updateTenant(tenantId, request));
    }

    @PostMapping("/tenants/{tenantId}/suspend")
    public ResponseEntity<TenantResponse> suspendTenant(@PathVariable Long tenantId) {
        return ResponseEntity.ok(tenantService.suspendTenant(tenantId));
    }

    @PostMapping("/tenants/{tenantId}/activate")
    public ResponseEntity<TenantResponse> activateTenant(@PathVariable Long tenantId) {
        return ResponseEntity.ok(tenantService.activateTenant(tenantId));
    }

    @DeleteMapping("/tenants/{tenantId}")
    public ResponseEntity<Void> deleteTenant(@PathVariable Long tenantId) {
        tenantService.deleteTenant(tenantId);
        return ResponseEntity.noContent().build();
    }

    // ─── Cross-tenant user management ─────────────────────────────────────────

    @GetMapping("/users")
    public ResponseEntity<PagedResponse<UserResponse>> getAllUsers(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String role,
            @RequestParam(required = false) String accountStatus,
            @RequestParam(required = false) Long tenantId,
            @RequestParam(required = false, defaultValue = "name-asc") String sort) {
        return ResponseEntity.ok(userManagementService.getUsers(
            page, size, search, role, accountStatus, tenantId, sort));
    }

    @GetMapping("/users/stats")
    public ResponseEntity<UserStatsResponse> getUserStats() {
        return ResponseEntity.ok(userManagementService.getUserStats());
    }

    @GetMapping("/users/{userId}")
    public ResponseEntity<UserResponse> getUser(@PathVariable Long userId) {
        return ResponseEntity.ok(userManagementService.getUser(userId));
    }

    @PostMapping("/users")
    public ResponseEntity<UserResponse> createUser(@Valid @RequestBody CreateUserRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
            .body(userManagementService.createUser(request, currentUserId()));
    }

    @PutMapping("/users/{userId}")
    public ResponseEntity<UserResponse> updateUser(@PathVariable Long userId,
                                                    @Valid @RequestBody UpdateUserRequest request) {
        return ResponseEntity.ok(userManagementService.updateUser(userId, request));
    }

    @DeleteMapping("/users/{userId}")
    public ResponseEntity<Void> deleteUser(@PathVariable Long userId) {
        userManagementService.deleteUser(userId);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/users/{userId}/role")
    public ResponseEntity<UserResponse> assignRole(@PathVariable Long userId,
                                                    @RequestBody Map<String, String> body) {
        String roleName = body.get("roleName");
        if (roleName == null || roleName.isBlank()) {
            throw new IllegalArgumentException("roleName is required");
        }
        return ResponseEntity.ok(authService.assignRole(userId, roleName));
    }

    @PostMapping("/users/{userId}/lock")
    public ResponseEntity<UserResponse> lockUser(@PathVariable Long userId) {
        return ResponseEntity.ok(authService.lockAccount(userId));
    }

    @PostMapping("/users/{userId}/unlock")
    public ResponseEntity<UserResponse> unlockUser(@PathVariable Long userId) {
        return ResponseEntity.ok(authService.unlockAccount(userId));
    }

    @PostMapping("/users/{userId}/reset-password")
    public ResponseEntity<Void> resetPassword(@PathVariable Long userId,
                                               @RequestBody Map<String, String> body) {
        String newPassword = body.get("newPassword");
        if (newPassword == null || newPassword.length() < 8) {
            throw new IllegalArgumentException("newPassword must be at least 8 characters");
        }
        authService.resetPassword(userId, newPassword);
        return ResponseEntity.ok().build();
    }

    // ─── System overview ───────────────────────────────────────────────────────

    @GetMapping("/overview")
    public ResponseEntity<Map<String, Object>> getSystemOverview() {
        TenantStatsResponse tenantStats = tenantService.getTenantStats();
        UserStatsResponse userStats = userManagementService.getUserStats();
        return ResponseEntity.ok(Map.of(
            "totalTenants", tenantStats.getTotalTenants(),
            "activeTenants", tenantStats.getActiveTenants(),
            "suspendedTenants", tenantStats.getSuspendedTenants(),
            "totalUsers", userStats.getTotalUsers()
        ));
    }

    private Long currentUserId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || auth.getPrincipal() == null) return 0L;
        Object principal = auth.getPrincipal();
        if (principal instanceof Long id) return id;
        try { return Long.parseLong(principal.toString()); } catch (NumberFormatException e) { return 0L; }
    }
}
