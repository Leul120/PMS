package com.procurement.authservice.service;

import com.procurement.authservice.dto.*;
import com.procurement.authservice.entity.Role;
import com.procurement.authservice.entity.SystemSettings;
import com.procurement.authservice.entity.User;
import com.procurement.authservice.infrastructure.cache.AuthCacheNames;
import com.procurement.authservice.infrastructure.lock.DistributedLock;
import com.procurement.authservice.repository.RoleRepository;
import com.procurement.authservice.repository.SystemSettingsRepository;
import com.procurement.authservice.repository.UserRepository;
import com.procurement.authservice.security.JwtTokenProvider;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.cache.annotation.Caching;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class AuthService {
    
    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider jwtTokenProvider;
    private final AuditLogService auditLogService;
    private final SystemSettingsRepository settingsRepository;
    
    @Transactional
    public LoginResponse login(LoginRequest request) {
        User user = userRepository.findByEmail(request.getEmail())
            .orElseThrow(() -> new RuntimeException("Invalid email or password"));
        
        // Check if account is locked
        if (user.getAccountLocked()) {
            throw new RuntimeException("Account is locked due to too many failed login attempts. Please contact administrator.");
        }
        
        if (!passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            // Increment failed login attempts
            int failedAttempts = user.getFailedLoginAttempts() + 1;
            user.setFailedLoginAttempts(failedAttempts);
            user.setLastFailedLogin(LocalDateTime.now());
            
            // Lock account after 5 failed attempts
            if (failedAttempts >= 5) {
                user.setAccountLocked(true);
                user.setLockTime(LocalDateTime.now());
                auditLogService.logAction("ACCOUNT_LOCKED", "User", user.getUserId().toString(), 
                    "Account locked after " + failedAttempts + " failed login attempts", user.getUserId());
            }
            
            userRepository.save(user);
            throw new RuntimeException("Invalid email or password. Attempt " + failedAttempts + " of 5.");
        }
        
        // Reset failed attempts on successful login
        if (user.getFailedLoginAttempts() > 0) {
            user.setFailedLoginAttempts(0);
        }
        
        user.setLastLogin(LocalDateTime.now());
        userRepository.save(user);
        
        String token = jwtTokenProvider.generateToken(
            user.getUserId(),
            user.getEmail(),
            user.getRole().getRoleName(),
            user.getRole().getPermissions()
        );
        
        auditLogService.logAction("LOGIN", "User", null, 
            "User: " + user.getEmail() + " logged in", user.getUserId());
        
        return LoginResponse.builder()
            .accessToken(token)
            .tokenType("Bearer")
            .userId(user.getUserId())
            .email(user.getEmail())
            .fullName(user.getFullName())
            .role(user.getRole().getRoleName())
            .build();
    }
    
    /**
     * Public registration - only VENDOR role can self-register.
     * Other roles (ADMIN, OFFICER, MANAGER, AUDITOR) must be created by an ADMIN.
     */
    @Transactional
    public UserResponse register(RegisterRequest request) {
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new RuntimeException("Email already registered");
        }
        
        // Force VENDOR role for all self-registrations
        // Only ADMIN can create users with other roles via UserManagementController
        Role vendorRole = roleRepository.findByRoleName("VENDOR")
            .orElseThrow(() -> new RuntimeException("VENDOR role not found"));
        
        User user = new User();
        user.setFullName(request.getFullName());
        user.setEmail(request.getEmail());
        user.setPasswordHash(passwordEncoder.encode(request.getPassword()));
        user.setPhoneNumber(request.getPhoneNumber());
        user.setRole(vendorRole);
        user.setRegistrationDate(LocalDateTime.now());
        user.setAccountLocked(false);
        user.setFailedLoginAttempts(0);
        
        User savedUser = userRepository.save(user);
        
        auditLogService.logAction("REGISTER", "User", savedUser.getUserId().toString(), 
            "Vendor self-registered: " + savedUser.getEmail(), savedUser.getUserId());
        
        log.info("Vendor self-registered: {}", savedUser.getEmail());
        
        return mapToUserResponse(savedUser);
    }
    
    @Cacheable(value = "users", key = AuthCacheNames.USER_BY_ID + ":#userId", sync = true)
    @Transactional(readOnly = true)
    public UserResponse getCurrentUser(Long userId) {
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new RuntimeException("User not found"));
        return mapToUserResponse(user);
    }

    @DistributedLock(key = "'user:update:' + #userId", waitTime = 5, leaseTime = 30)
    @Caching(evict = {
        @CacheEvict(value = "users", key = AuthCacheNames.USER_BY_ID + ":#userId")
    })
    @Transactional
    public UserResponse updateUser(Long userId, UpdateUserRequest request) {
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new RuntimeException("User not found"));

        if (request.getFullName() != null) {
            user.setFullName(request.getFullName());
        }
        if (request.getPhoneNumber() != null) {
            user.setPhoneNumber(request.getPhoneNumber());
        }

        User updatedUser = userRepository.save(user);

        auditLogService.logAction("UPDATE", "User", null,
            "User profile updated: " + userId, userId);

        return mapToUserResponse(updatedUser);
    }
    
    @Transactional(readOnly = true)
    public List<UserResponse> getAllUsers() {
        return userRepository.findAll().stream()
            .map(this::mapToUserResponse)
            .collect(Collectors.toList());
    }
    
    @Transactional
    public UserResponse unlockAccount(Long userId) {
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new RuntimeException("User not found"));
        
        user.setAccountLocked(false);
        user.setFailedLoginAttempts(0);
        user.setLockTime(null);
        
        User updatedUser = userRepository.save(user);
        
        auditLogService.logAction("UNLOCK_ACCOUNT", "User", null, 
            "Account unlocked by admin", userId);
        
        return mapToUserResponse(updatedUser);
    }
    
    @Transactional
    public UserResponse assignRole(Long userId, String roleName) {
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new RuntimeException("User not found"));
        
        Role role = roleRepository.findByRoleName(roleName)
            .orElseThrow(() -> new RuntimeException("Role not found: " + roleName));
        
        user.setRole(role);
        User updatedUser = userRepository.save(user);
        
        auditLogService.logAction("ASSIGN_ROLE", "User", null, 
            "Role assigned to user: " + roleName, userId);
        
        return mapToUserResponse(updatedUser);
    }
    
    @Transactional
    public UserResponse lockAccount(Long userId) {
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new RuntimeException("User not found"));
        
        user.setAccountLocked(true);
        user.setLockTime(LocalDateTime.now());
        
        User updatedUser = userRepository.save(user);
        
        auditLogService.logAction("LOCK_ACCOUNT", "User", null, 
            "Account locked by admin", userId);
        
        return mapToUserResponse(updatedUser);
    }
    
    @Transactional
    public void resetPassword(Long userId, String newPassword) {
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new RuntimeException("User not found"));
        
        user.setPasswordHash(passwordEncoder.encode(newPassword));
        user.setFailedLoginAttempts(0);
        user.setAccountLocked(false);
        userRepository.save(user);
        
        auditLogService.logAction("RESET_PASSWORD", "User", null, 
            "Password reset by admin", userId);
        
        log.info("Password reset for user: {}", userId);
    }
    
    public Map<String, Object> getSettings() {
        Map<String, Object> defaults = new java.util.LinkedHashMap<>();
        defaults.put("companyName", "ProcurePro Inc.");
        defaults.put("taxId", "");
        defaults.put("timezone", "UTC");
        defaults.put("currency", "USD");
        // Overlay persisted values
        settingsRepository.findByCategoryAndUserId("SYSTEM", null)
            .forEach(s -> defaults.put(s.getSettingKey(), s.getSettingValue()));
        return defaults;
    }

    @Transactional
    public Map<String, Object> updateSettings(Map<String, Object> settings) {
        settings.forEach((key, value) -> {
            SystemSettings s = settingsRepository
                .findBySettingKeyAndCategoryAndUserId(key, "SYSTEM", null)
                .orElse(new SystemSettings(null, key, null, "SYSTEM", null));
            s.setSettingValue(value != null ? value.toString() : null);
            settingsRepository.save(s);
        });
        auditLogService.logAction("UPDATE_SETTINGS", "SystemSettings", null,
            "System settings updated: " + settings.keySet(), null);
        log.info("System settings persisted: {}", settings.keySet());
        return getSettings();
    }

    public Map<String, Object> getNotificationSettings() {
        Map<String, Object> defaults = new java.util.LinkedHashMap<>();
        defaults.put("email", true);
        defaults.put("poApprovals", true);
        defaults.put("deliveryAlerts", true);
        defaults.put("vendorUpdates", false);
        defaults.put("lowStockAlerts", true);
        defaults.put("dailyDigest", false);
        settingsRepository.findByCategoryAndUserId("NOTIFICATION", null)
            .forEach(s -> defaults.put(s.getSettingKey(), parseBoolean(s.getSettingValue())));
        return defaults;
    }

    @Transactional
    public Map<String, Object> updateNotificationSettings(Map<String, Object> settings) {
        settings.forEach((key, value) -> {
            SystemSettings s = settingsRepository
                .findBySettingKeyAndCategoryAndUserId(key, "NOTIFICATION", null)
                .orElse(new SystemSettings(null, key, null, "NOTIFICATION", null));
            s.setSettingValue(value != null ? value.toString() : null);
            settingsRepository.save(s);
        });
        log.info("Notification settings persisted: {}", settings.keySet());
        return getNotificationSettings();
    }

    public Map<String, Object> getSecuritySettings() {
        Map<String, Object> defaults = new java.util.LinkedHashMap<>();
        defaults.put("twoFactor", false);
        defaults.put("sessionTimeout", 30);
        defaults.put("passwordExpiry", 90);
        defaults.put("loginNotifications", true);
        settingsRepository.findByCategoryAndUserId("SECURITY", null)
            .forEach(s -> {
                // Numeric fields
                if ("sessionTimeout".equals(s.getSettingKey()) || "passwordExpiry".equals(s.getSettingKey())) {
                    try { defaults.put(s.getSettingKey(), Integer.parseInt(s.getSettingValue())); }
                    catch (NumberFormatException ignored) {}
                } else {
                    defaults.put(s.getSettingKey(), parseBoolean(s.getSettingValue()));
                }
            });
        return defaults;
    }

    @Transactional
    public Map<String, Object> updateSecuritySettings(Map<String, Object> settings) {
        // Validate sessionTimeout >= 15 minutes
        if (settings.containsKey("sessionTimeout")) {
            int timeout = Integer.parseInt(settings.get("sessionTimeout").toString());
            if (timeout < 15) throw new RuntimeException("Session timeout must be at least 15 minutes");
        }
        settings.forEach((key, value) -> {
            SystemSettings s = settingsRepository
                .findBySettingKeyAndCategoryAndUserId(key, "SECURITY", null)
                .orElse(new SystemSettings(null, key, null, "SECURITY", null));
            s.setSettingValue(value != null ? value.toString() : null);
            settingsRepository.save(s);
        });
        auditLogService.logAction("UPDATE_SECURITY_SETTINGS", "SystemSettings", null,
            "Security settings updated: " + settings.keySet(), null);
        log.info("Security settings persisted: {}", settings.keySet());
        return getSecuritySettings();
    }

    private Object parseBoolean(String value) {
        if (value == null) return false;
        return Boolean.parseBoolean(value);
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
            .active(!Boolean.TRUE.equals(user.getAccountLocked()))
            .accountLocked(Boolean.TRUE.equals(user.getAccountLocked()))
            .build();
    }
}
