package com.procurement.authservice.controller;

import com.procurement.authservice.aspect.Auditable;
import com.procurement.authservice.dto.*;
import com.procurement.authservice.service.UserManagementService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * User Management Controller - Only accessible by ADMIN
 * Handles user creation, role assignment, and account management
 */
@RestController
@RequestMapping("/api/admin/users")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class UserManagementController {

    private final UserManagementService userManagementService;

    @GetMapping
    @Auditable(action = "READ", entityType = "User")
    public ResponseEntity<List<UserResponse>> getAllUsers() {
        return ResponseEntity.ok(userManagementService.getAllUsers());
    }

    @GetMapping("/{userId}")
    @Auditable(action = "READ", entityType = "User")
    public ResponseEntity<UserResponse> getUser(@PathVariable Long userId) {
        return ResponseEntity.ok(userManagementService.getUser(userId));
    }

    @PostMapping
    @Auditable(action = "CREATE", entityType = "User")
    public ResponseEntity<UserResponse> createUser(
            @Valid @RequestBody CreateUserRequest request,
            @RequestHeader("X-User-Id") Long adminId) {
        return ResponseEntity.ok(userManagementService.createUser(request, adminId));
    }

    @PutMapping("/{userId}")
    @Auditable(action = "UPDATE", entityType = "User")
    public ResponseEntity<UserResponse> updateUser(
            @PathVariable Long userId,
            @Valid @RequestBody UpdateUserRequest request) {
        return ResponseEntity.ok(userManagementService.updateUser(userId, request));
    }

    @DeleteMapping("/{userId}")
    @Auditable(action = "DELETE", entityType = "User")
    public ResponseEntity<Void> deleteUser(@PathVariable Long userId) {
        userManagementService.deleteUser(userId);
        return ResponseEntity.ok().build();
    }

    @PutMapping("/{userId}/role")
    @Auditable(action = "UPDATE_ROLE", entityType = "User")
    public ResponseEntity<UserResponse> assignRole(
            @PathVariable Long userId,
            @RequestParam String roleName) {
        return ResponseEntity.ok(userManagementService.assignRole(userId, roleName));
    }

    @PostMapping("/{userId}/lock")
    @Auditable(action = "LOCK_ACCOUNT", entityType = "User")
    public ResponseEntity<UserResponse> lockAccount(@PathVariable Long userId) {
        return ResponseEntity.ok(userManagementService.lockAccount(userId));
    }

    @PostMapping("/{userId}/unlock")
    @Auditable(action = "UNLOCK_ACCOUNT", entityType = "User")
    public ResponseEntity<UserResponse> unlockAccount(@PathVariable Long userId) {
        return ResponseEntity.ok(userManagementService.unlockAccount(userId));
    }

    @PostMapping("/{userId}/reset-password")
    @Auditable(action = "RESET_PASSWORD", entityType = "User")
    public ResponseEntity<UserResponse> resetPassword(
            @PathVariable Long userId,
            @RequestParam String newPassword) {
        return ResponseEntity.ok(userManagementService.resetPassword(userId, newPassword));
    }
}
