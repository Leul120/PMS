package com.procurement.authservice.service;

import com.procurement.authservice.dto.*;
import com.procurement.authservice.entity.Role;
import com.procurement.authservice.entity.User;
import com.procurement.authservice.repository.RoleRepository;
import com.procurement.authservice.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class UserManagementService {

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuditLogService auditLogService;

    @Transactional(readOnly = true)
    public List<UserResponse> getAllUsers() {
        return userRepository.findAll().stream()
                .map(this::mapToUserResponse)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public UserResponse getUser(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found: " + userId));
        return mapToUserResponse(user);
    }

    @Transactional
    public UserResponse createUser(CreateUserRequest request, Long adminId) {
        // Check if email already exists
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new RuntimeException("Email already registered: " + request.getEmail());
        }

        // Find the role
        Role role = roleRepository.findByRoleName(request.getRoleName())
                .orElseThrow(() -> new RuntimeException("Role not found: " + request.getRoleName()));

        // Create user
        User user = new User();
        user.setFullName(request.getFullName());
        user.setEmail(request.getEmail());
        user.setPasswordHash(passwordEncoder.encode(request.getPassword()));
        user.setPhoneNumber(request.getPhoneNumber());
        user.setRole(role);
        user.setRegistrationDate(LocalDateTime.now());
        user.setAccountLocked(false);
        user.setFailedLoginAttempts(0);

        User savedUser = userRepository.save(user);

        // Audit log
        auditLogService.logAction("CREATE_USER", "User", savedUser.getUserId().toString(),
                "Admin " + adminId + " created user " + savedUser.getEmail() + " with role " + role.getRoleName(),
                adminId);

        log.info("User created by admin {}: {} with role {}", adminId, savedUser.getEmail(), role.getRoleName());

        return mapToUserResponse(savedUser);
    }

    @Transactional
    public UserResponse updateUser(Long userId, UpdateUserRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found: " + userId));

        if (request.getFullName() != null) {
            user.setFullName(request.getFullName());
        }
        if (request.getPhoneNumber() != null) {
            user.setPhoneNumber(request.getPhoneNumber());
        }

        User updatedUser = userRepository.save(user);

        auditLogService.logAction("UPDATE_USER", "User", userId.toString(),
                "User profile updated by admin", null);

        return mapToUserResponse(updatedUser);
    }

    @Transactional
    public void deleteUser(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found: " + userId));

        // Don't allow deleting the default admin
        if ("admin@procurement.com".equals(user.getEmail())) {
            throw new RuntimeException("Cannot delete the default admin user");
        }

        userRepository.delete(user);

        auditLogService.logAction("DELETE_USER", "User", userId.toString(),
                "User deleted by admin: " + user.getEmail(), null);

        log.info("User deleted: {}", user.getEmail());
    }

    @Transactional
    public UserResponse assignRole(Long userId, String roleName) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found: " + userId));

        Role newRole = roleRepository.findByRoleName(roleName)
                .orElseThrow(() -> new RuntimeException("Role not found: " + roleName));

        String oldRole = user.getRole().getRoleName();
        user.setRole(newRole);

        User updatedUser = userRepository.save(user);

        auditLogService.logAction("ASSIGN_ROLE", "User", userId.toString(),
                "Role changed from " + oldRole + " to " + roleName, null);

        log.info("User {} role changed from {} to {}", user.getEmail(), oldRole, roleName);

        return mapToUserResponse(updatedUser);
    }

    @Transactional
    public UserResponse lockAccount(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found: " + userId));

        // Don't allow locking the default admin
        if ("admin@procurement.com".equals(user.getEmail())) {
            throw new RuntimeException("Cannot lock the default admin user");
        }

        user.setAccountLocked(true);
        user.setLockTime(LocalDateTime.now());

        User updatedUser = userRepository.save(user);

        auditLogService.logAction("LOCK_ACCOUNT", "User", userId.toString(),
                "Account locked by admin", null);

        log.info("Account locked: {}", user.getEmail());

        return mapToUserResponse(updatedUser);
    }

    @Transactional
    public UserResponse unlockAccount(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found: " + userId));

        user.setAccountLocked(false);
        user.setFailedLoginAttempts(0);
        user.setLockTime(null);

        User updatedUser = userRepository.save(user);

        auditLogService.logAction("UNLOCK_ACCOUNT", "User", userId.toString(),
                "Account unlocked by admin", null);

        log.info("Account unlocked: {}", user.getEmail());

        return mapToUserResponse(updatedUser);
    }

    @Transactional
    public UserResponse resetPassword(Long userId, String newPassword) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found: " + userId));

        user.setPasswordHash(passwordEncoder.encode(newPassword));

        User updatedUser = userRepository.save(user);

        auditLogService.logAction("RESET_PASSWORD", "User", userId.toString(),
                "Password reset by admin", null);

        log.info("Password reset for user: {}", user.getEmail());

        return mapToUserResponse(updatedUser);
    }

    private UserResponse mapToUserResponse(User user) {
        return UserResponse.builder()
                .userId(user.getUserId())
                .fullName(user.getFullName())
                .email(user.getEmail())
                .phoneNumber(user.getPhoneNumber())
                .roleName(user.getRole().getRoleName())
                .lastLogin(user.getLastLogin())
                .registrationDate(user.getRegistrationDate())
                .build();
    }
}
