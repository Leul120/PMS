package com.procurement.authservice.controller;

import com.procurement.authservice.dto.*;
import com.procurement.authservice.security.TokenBlacklistService;
import com.procurement.authservice.service.AuthService;
import com.procurement.authservice.service.AuditLogService;
import com.procurement.authservice.service.PasswordResetService;
import com.procurement.authservice.service.TenantService;
import com.procurement.authservice.service.UserManagementService;
import com.procurement.authservice.tenant.TenantContext;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.util.StringUtils;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
@Slf4j
public class AuthController {
    
    private final AuthService authService;
    private final AuditLogService auditLogService;
    private final PasswordResetService passwordResetService;
    private final UserManagementService userManagementService;
    private final TenantService tenantService;
    private final TokenBlacklistService tokenBlacklistService;
    
    @PostMapping("/login")
    public ResponseEntity<LoginResponse> login(@Valid @RequestBody LoginRequest request, HttpServletRequest httpRequest) {
        log.info("Login attempt - Content-Type: {}, Body email: {}", httpRequest.getContentType(), request.getEmail());
        return ResponseEntity.ok(authService.login(request));
    }
    
    @PostMapping("/register")
    public ResponseEntity<UserResponse> register(@Valid @RequestBody RegisterRequest request) {
        return ResponseEntity.ok(authService.register(request));
    }
    
    @PostMapping("/logout")
    public ResponseEntity<Void> logout(HttpServletRequest request) {
        String bearer = request.getHeader("Authorization");
        if (StringUtils.hasText(bearer) && bearer.startsWith("Bearer ")) {
            tokenBlacklistService.blacklist(bearer.substring(7));
        }
        return ResponseEntity.ok().build();
    }

    @GetMapping("/my-tenants")
    public ResponseEntity<List<com.procurement.authservice.dto.TenantSummary>> getMyTenants(
            @AuthenticationPrincipal Long userId) {
        return ResponseEntity.ok(authService.getMyTenants(userId));
    }

    @PostMapping("/switch-tenant")
    public ResponseEntity<LoginResponse> switchTenant(
            @Valid @RequestBody com.procurement.authservice.dto.SwitchTenantRequest request,
            @AuthenticationPrincipal Long userId) {
        return ResponseEntity.ok(authService.switchTenant(request.getTenantDomain(), userId));
    }

    @PostMapping("/switch-context")
    public ResponseEntity<LoginResponse> switchContext(
            @Valid @RequestBody SwitchContextRequest request,
            @AuthenticationPrincipal Long userId) {
        return ResponseEntity.ok(authService.switchOperatingContext(userId, request.getContext()));
    }

    @PostMapping("/forgot-password")
    public ResponseEntity<Map<String, String>> forgotPassword(
            @Valid @RequestBody ForgotPasswordRequest request) {
        passwordResetService.forgotPassword(request.getEmail());
        // Always return 200 to avoid user enumeration
        return ResponseEntity.ok(Map.of("message",
                "If that email is registered, a reset link has been sent."));
    }

    @PostMapping("/reset-password")
    public ResponseEntity<Map<String, String>> resetPassword(
            @Valid @RequestBody ResetPasswordRequest request) {
        passwordResetService.resetPassword(request.getToken(), request.getNewPassword());
        return ResponseEntity.ok(Map.of("message", "Password has been reset successfully."));
    }
    
    @GetMapping("/me")
    public ResponseEntity<UserResponse> getCurrentUser(@AuthenticationPrincipal Long userId) {
        return ResponseEntity.ok(authService.getCurrentUser(userId));
    }
    
    @PutMapping("/users/{userId}")
    public ResponseEntity<UserResponse> updateUser(
            @PathVariable Long userId,
            @Valid @RequestBody UpdateUserRequest request) {
        return ResponseEntity.ok(authService.updateUser(userId, request));
    }
    
    @GetMapping("/users")
    public ResponseEntity<PagedResponse<UserResponse>> listUsers(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String role,
            @RequestParam(required = false) String accountStatus,
            @RequestParam(required = false, defaultValue = "name-asc") String sort) {
        return ResponseEntity.ok(userManagementService.getUsers(
            page, size, search, role, accountStatus, null, sort));
    }

    @GetMapping("/users/stats")
    public ResponseEntity<UserStatsResponse> getUserStats() {
        return ResponseEntity.ok(userManagementService.getUserStats());
    }
    
    @GetMapping("/audit-logs")
    public ResponseEntity<List<AuditLogResponse>> getAuditLogs() {
        return ResponseEntity.ok(auditLogService.getAllAuditLogs());
    }
    
    @PostMapping("/users/{userId}/unlock")
    public ResponseEntity<UserResponse> unlockAccount(@PathVariable Long userId) {
        return ResponseEntity.ok(authService.unlockAccount(userId));
    }
    
    // Admin user management endpoints
    @PostMapping("/admin/users")
    public ResponseEntity<UserResponse> createUser(
            @Valid @RequestBody CreateUserRequest request,
            @AuthenticationPrincipal Long adminId) {
        return ResponseEntity.ok(userManagementService.createUser(request, adminId != null ? adminId : 0L));
    }
    
    @PutMapping("/admin/users/{userId}/role")
    public ResponseEntity<UserResponse> assignRole(
            @PathVariable Long userId,
            @RequestBody Map<String, String> request) {
        String roleName = request.get("roleName");
        if (roleName == null || roleName.isBlank()) {
            throw new IllegalArgumentException("roleName is required");
        }
        return ResponseEntity.ok(authService.assignRole(userId, roleName));
    }
    
    @PostMapping("/admin/users/{userId}/lock")
    public ResponseEntity<UserResponse> lockAccount(@PathVariable Long userId) {
        return ResponseEntity.ok(authService.lockAccount(userId));
    }
    
    @PostMapping("/admin/users/{userId}/reset-password")
    public ResponseEntity<Void> resetPassword(
            @PathVariable Long userId,
            @RequestBody Map<String, String> request) {
        String newPassword = request.get("newPassword");
        if (newPassword == null || newPassword.length() < 8) {
            throw new IllegalArgumentException("newPassword must be at least 8 characters");
        }
        authService.resetPassword(userId, newPassword);
        return ResponseEntity.ok().build();
    }

    @GetMapping("/my-tenant")
    public ResponseEntity<TenantResponse> getMyTenant() {
        Long tenantId = TenantContext.getCurrentTenant();
        if (tenantId == null) return ResponseEntity.notFound().build();
        return ResponseEntity.ok(tenantService.getTenant(tenantId));
    }

    @PutMapping("/my-tenant")
    public ResponseEntity<TenantResponse> updateMyTenant(@RequestBody Map<String, String> body) {
        Long tenantId = TenantContext.getCurrentTenant();
        if (tenantId == null) return ResponseEntity.notFound().build();
        return ResponseEntity.ok(tenantService.updateTenantName(tenantId, body.get("name")));
    }

    @PostMapping("/change-password")
    public ResponseEntity<Map<String, String>> changePassword(
            @RequestBody Map<String, String> request,
            @AuthenticationPrincipal Long userId) {
        String newPassword = request.get("newPassword");
        if (newPassword == null || newPassword.length() < 8) {
            throw new IllegalArgumentException("New password must be at least 8 characters");
        }
        String currentPassword = request.get("currentPassword");
        if (currentPassword == null || currentPassword.isBlank()) {
            throw new IllegalArgumentException("Current password is required");
        }
        authService.changePassword(userId, currentPassword, newPassword);
        return ResponseEntity.ok(Map.of("message", "Password changed successfully."));
    }
    
    // Vendor team invitation (VENDOR_ADMIN only)
    @PostMapping("/invite")
    public ResponseEntity<UserResponse> inviteTeamMember(
            @Valid @RequestBody InviteRequest request,
            @AuthenticationPrincipal Long inviterId) {
        return ResponseEntity.ok(authService.inviteTeamMember(inviterId, request));
    }

    // Permanent deactivation (SUPER_ADMIN only — enforced by SecurityConfig /api/super-admin/**)
    @PostMapping("/super-admin/users/{userId}/deactivate")
    public ResponseEntity<UserResponse> deactivateUser(@PathVariable Long userId) {
        return ResponseEntity.ok(authService.deactivateUser(userId));
    }

    // Vendor approval endpoints (super admin only — enforced at gateway level)
    @GetMapping("/vendor-approvals")
    public ResponseEntity<List<UserResponse>> getPendingVendorApprovals() {
        return ResponseEntity.ok(authService.getPendingVendorApprovals());
    }

    @PostMapping("/vendor-approvals/{userId}/approve")
    public ResponseEntity<UserResponse> approveVendor(@PathVariable Long userId) {
        return ResponseEntity.ok(authService.approveVendor(userId));
    }

    @PostMapping("/vendor-approvals/{userId}/reject")
    public ResponseEntity<UserResponse> rejectVendor(@PathVariable Long userId) {
        return ResponseEntity.ok(authService.rejectVendor(userId));
    }

    // Settings endpoints
    @GetMapping("/settings")
    public ResponseEntity<Map<String, Object>> getSettings() {
        return ResponseEntity.ok(authService.getSettings());
    }
    
    @PutMapping("/settings")
    public ResponseEntity<Map<String, Object>> updateSettings(@RequestBody Map<String, Object> settings) {
        return ResponseEntity.ok(authService.updateSettings(settings));
    }
    
    @GetMapping("/settings/notifications")
    public ResponseEntity<Map<String, Object>> getNotificationSettings() {
        return ResponseEntity.ok(authService.getNotificationSettings());
    }
    
    @PutMapping("/settings/notifications")
    public ResponseEntity<Map<String, Object>> updateNotificationSettings(@RequestBody Map<String, Object> settings) {
        return ResponseEntity.ok(authService.updateNotificationSettings(settings));
    }
    
    @GetMapping("/settings/security")
    public ResponseEntity<Map<String, Object>> getSecuritySettings() {
        return ResponseEntity.ok(authService.getSecuritySettings());
    }
    
    @PutMapping("/settings/security")
    public ResponseEntity<Map<String, Object>> updateSecuritySettings(@RequestBody Map<String, Object> settings) {
        return ResponseEntity.ok(authService.updateSecuritySettings(settings));
    }
}
