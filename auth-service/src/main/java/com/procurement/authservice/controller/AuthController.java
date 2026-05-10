package com.procurement.authservice.controller;

import com.procurement.authservice.dto.*;
import com.procurement.authservice.service.AuthService;
import com.procurement.authservice.service.AuditLogService;
import com.procurement.authservice.service.PasswordResetService;
import com.procurement.authservice.service.UserManagementService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
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
    public ResponseEntity<Void> logout() {
        return ResponseEntity.ok().build();
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
    @PreAuthorize("#userId == authentication.principal or hasRole('ADMIN')")
    public ResponseEntity<UserResponse> updateUser(
            @PathVariable Long userId,
            @RequestBody UpdateUserRequest request) {
        return ResponseEntity.ok(authService.updateUser(userId, request));
    }
    
    @GetMapping("/users")
    @PreAuthorize("hasAnyRole('ADMIN', 'OFFICER', 'MANAGER', 'AUDITOR')")
    public ResponseEntity<List<UserResponse>> listUsers() {
        return ResponseEntity.ok(authService.getAllUsers());
    }
    
    @GetMapping("/audit-logs")
    @PreAuthorize("hasAnyRole('ADMIN', 'AUDITOR')")
    public ResponseEntity<List<AuditLogResponse>> getAuditLogs() {
        return ResponseEntity.ok(auditLogService.getAllAuditLogs());
    }
    
    @PostMapping("/users/{userId}/unlock")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<UserResponse> unlockAccount(@PathVariable Long userId) {
        return ResponseEntity.ok(authService.unlockAccount(userId));
    }
    
    // Admin user management endpoints
    @PostMapping("/admin/users")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<UserResponse> createUser(
            @Valid @RequestBody CreateUserRequest request,
            @AuthenticationPrincipal Long adminId) {
        return ResponseEntity.ok(userManagementService.createUser(request, adminId != null ? adminId : 0L));
    }
    
    @PutMapping("/admin/users/{userId}/role")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<UserResponse> assignRole(
            @PathVariable Long userId,
            @RequestBody Map<String, String> request) {
        return ResponseEntity.ok(authService.assignRole(userId, request.get("roleName")));
    }
    
    @PostMapping("/admin/users/{userId}/lock")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<UserResponse> lockAccount(@PathVariable Long userId) {
        return ResponseEntity.ok(authService.lockAccount(userId));
    }
    
    @PostMapping("/admin/users/{userId}/reset-password")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> resetPassword(
            @PathVariable Long userId,
            @RequestBody Map<String, String> request) {
        authService.resetPassword(userId, request.get("newPassword"));
        return ResponseEntity.ok().build();
    }
    
    // Settings endpoints
    @GetMapping("/settings")
    public ResponseEntity<Map<String, Object>> getSettings() {
        return ResponseEntity.ok(authService.getSettings());
    }
    
    @PutMapping("/settings")
    @PreAuthorize("hasRole('ADMIN')")
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
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, Object>> updateSecuritySettings(@RequestBody Map<String, Object> settings) {
        return ResponseEntity.ok(authService.updateSecuritySettings(settings));
    }
}
