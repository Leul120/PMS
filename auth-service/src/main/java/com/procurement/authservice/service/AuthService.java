package com.procurement.authservice.service;

import com.procurement.authservice.dto.*;
import com.procurement.authservice.dto.TenantSummary;
import com.procurement.authservice.entity.Role;
import com.procurement.authservice.entity.SystemSettings;
import com.procurement.authservice.entity.Tenant;
import com.procurement.authservice.entity.User;
import com.procurement.authservice.infrastructure.cache.AuthCacheNames;
import com.procurement.authservice.infrastructure.lock.DistributedLock;
import com.procurement.authservice.repository.RoleRepository;
import com.procurement.authservice.repository.SystemSettingsRepository;
import com.procurement.authservice.repository.TenantRepository;
import com.procurement.authservice.repository.UserRepository;
import com.procurement.authservice.security.JwtTokenProvider;
import com.procurement.authservice.security.TokenBlacklistService;
import com.procurement.authservice.tenant.TenantAccessException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.cache.annotation.Caching;
import org.springframework.dao.CannotAcquireLockException;
import org.springframework.dao.DeadlockLoserDataAccessException;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.retry.annotation.Backoff;
import org.springframework.retry.annotation.Retryable;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

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
    private final TenantRepository tenantRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider jwtTokenProvider;
    private final TokenBlacklistService tokenBlacklistService;
    private final AuditLogService auditLogService;
    private final SystemSettingsRepository settingsRepository;
    private final JavaMailSender mailSender;
    private final OperatingContextService operatingContextService;

    @Value("${app.frontend-url:http://localhost:3000}")
    private String frontendUrl;

    @Transactional
    public LoginResponse login(LoginRequest request) {
        // Resolve tenant from request domain or email domain
        Tenant tenant = resolveTenantForLogin(request);

        User user = userRepository.findByEmailAndTenant(request.getEmail(), tenant)
            .orElseThrow(() -> new RuntimeException("Invalid email or password"));

        if (Boolean.TRUE.equals(user.getDeactivated())) {
            throw new RuntimeException("This account has been permanently deactivated. Please contact the system administrator.");
        }

        if ("PENDING_APPROVAL".equals(user.getApprovalStatus())) {
            throw new RuntimeException("Your vendor account is pending approval by the super admin. You will be notified once approved.");
        }
        if ("REJECTED".equals(user.getApprovalStatus())) {
            throw new RuntimeException("Your vendor registration was not approved. Please contact the administrator.");
        }

        if (user.getAccountLocked()) {
            throw new RuntimeException("Account is locked due to too many failed login attempts. Please contact administrator.");
        }

        if (!passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            int failedAttempts = user.getFailedLoginAttempts() + 1;
            user.setFailedLoginAttempts(failedAttempts);
            user.setLastFailedLogin(LocalDateTime.now());

            if (failedAttempts >= 5) {
                user.setAccountLocked(true);
                user.setLockTime(LocalDateTime.now());
                auditLogService.logAction("ACCOUNT_LOCKED", "User", user.getUserId().toString(),
                    "Account locked after " + failedAttempts + " failed login attempts", user.getUserId());
            }

            userRepository.save(user);
            throw new RuntimeException("Invalid email or password. Attempt " + failedAttempts + " of 5.");
        }

        if (user.getFailedLoginAttempts() > 0) {
            user.setFailedLoginAttempts(0);
        }

        user.setLastLogin(LocalDateTime.now());
        userRepository.save(user);

        String defaultContext = operatingContextService.defaultContext(user, tenant);
        LoginResponse response = issueSessionToken(user, tenant, defaultContext);

        auditLogService.logAction("LOGIN", "User", null,
            "User: " + user.getEmail() + " logged in (tenant: " + tenant.getDomain()
                + ", context: " + defaultContext + ")", user.getUserId());

        return response;
    }

    @Transactional
    public LoginResponse switchOperatingContext(Long userId, String context) {
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new RuntimeException("User not found"));
        Tenant tenant = user.getTenant();
        operatingContextService.validateContext(user, tenant, context);

        LoginResponse response = issueSessionToken(user, tenant, context.toUpperCase());

        auditLogService.logAction("SWITCH_CONTEXT", "User", user.getUserId().toString(),
            "Switched operating context to " + context, userId);

        return response;
    }

    private LoginResponse issueSessionToken(User user, Tenant tenant, String operatingContext) {
        Role effectiveRole = operatingContextService.resolveEffectiveRole(user, operatingContext);
        List<String> available = operatingContextService.availableContexts(user, tenant);

        String token = jwtTokenProvider.generateToken(
            user.getUserId(),
            user.getEmail(),
            effectiveRole.getRoleName(),
            effectiveRole.getPermissions(),
            tenant.getTenantId(),
            operatingContext
        );

        return LoginResponse.builder()
            .accessToken(token)
            .tokenType("Bearer")
            .userId(user.getUserId())
            .email(user.getEmail())
            .fullName(user.getFullName())
            .role(effectiveRole.getRoleName())
            .procurementRole(user.getRole().getRoleName())
            .supplierRole(user.getSupplierRole() != null ? user.getSupplierRole().getRoleName() : null)
            .tenantId(tenant.getTenantId())
            .tenantName(tenant.getName())
            .tenantDomain(tenant.getDomain())
            .organizationType(tenant.getOrganizationType() != null
                ? tenant.getOrganizationType().name() : null)
            .operatingContext(operatingContext)
            .availableContexts(available)
            .mustChangePassword(Boolean.TRUE.equals(user.getMustChangePassword()))
            .build();
    }

    private static final java.util.Set<String> VENDOR_ROLES =
        java.util.Set.of("VENDOR_ADMIN", "VENDOR_SALES", "VENDOR_FINANCE", "VENDOR_LOGISTICS");

    @Transactional
    public UserResponse register(RegisterRequest request) {
        String roleName = request.getRoleName() != null ? request.getRoleName().toUpperCase() : "";
        Tenant tenant = VENDOR_ROLES.contains(roleName)
            ? resolveOrCreateTenant(request.getTenantDomain(), request.getCompanyName())
            : resolveOrDefaultTenant(request.getTenantDomain());

        if (userRepository.existsByEmailAndTenant(request.getEmail(), tenant)) {
            throw new RuntimeException("Email already registered in this tenant");
        }

        // Public self-registration always becomes VENDOR_ADMIN (the company owner)
        String effectiveRole = VENDOR_ROLES.contains(roleName) ? "VENDOR_ADMIN" : roleName;
        Role vendorRole = roleRepository.findByRoleName(effectiveRole)
            .orElseThrow(() -> new RuntimeException("Role not found: " + effectiveRole));

        User user = new User();
        user.setTenant(tenant);
        user.setFullName(request.getFullName());
        user.setEmail(request.getEmail());
        user.setPasswordHash(passwordEncoder.encode(request.getPassword()));
        user.setPhoneNumber(request.getPhoneNumber());
        user.setCompanyName(request.getCompanyName());
        user.setRole(vendorRole);
        user.setRegistrationDate(LocalDateTime.now());
        user.setAccountLocked(true); // blocked until super admin approves
        user.setApprovalStatus("PENDING_APPROVAL");
        user.setFailedLoginAttempts(0);

        User savedUser = userRepository.save(user);

        auditLogService.logAction("REGISTER", "User", savedUser.getUserId().toString(),
            "Vendor self-registered (pending approval): " + savedUser.getEmail() + " (tenant: " + tenant.getDomain() + ")", savedUser.getUserId());

        log.info("Vendor self-registered (pending approval): {} (tenant: {})", savedUser.getEmail(), tenant.getDomain());

        return mapToUserResponse(savedUser);
    }

    @Cacheable(value = "users", key = "#userId", sync = true)
    @Transactional(readOnly = true)
    public UserResponse getCurrentUser(Long userId) {
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new RuntimeException("User not found"));
        return mapToUserResponse(user);
    }

    @Retryable(
        retryFor = { CannotAcquireLockException.class, DeadlockLoserDataAccessException.class },
        maxAttempts = 3,
        backoff = @Backoff(delay = 100, multiplier = 2)
    )
    @DistributedLock(key = "'user:update:' + #userId", waitTime = 5, leaseTime = 30)
    @Caching(evict = {
        @CacheEvict(value = "users", key = "#userId")
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
        if (request.getEmail() != null && !request.getEmail().isBlank()) {
            String newEmail = request.getEmail().trim().toLowerCase();
            if (!newEmail.equals(user.getEmail())) {
                Long tenantId = user.getTenant() != null ? user.getTenant().getTenantId() : null;
                boolean taken = userRepository.findAll().stream()
                    .anyMatch(u -> !u.getUserId().equals(userId)
                        && newEmail.equals(u.getEmail())
                        && (tenantId == null || (u.getTenant() != null
                            && tenantId.equals(u.getTenant().getTenantId()))));
                if (taken) {
                    throw new RuntimeException("Email already in use");
                }
                user.setEmail(newEmail);
            }
        }

        User updatedUser = userRepository.save(user);

        auditLogService.logAction("UPDATE", "User", null,
            "User profile updated: " + userId, userId);

        return mapToUserResponse(updatedUser);
    }

    @Transactional(readOnly = true)
    public List<UserResponse> getAllUsers() {
        Long tenantId = com.procurement.authservice.tenant.TenantContext.getCurrentTenant();
        return userRepository.findAll().stream()
            .filter(u -> tenantId == null || (u.getTenant() != null && tenantId.equals(u.getTenant().getTenantId())))
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
    public UserResponse deactivateUser(Long userId) {
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new RuntimeException("User not found"));

        user.setDeactivated(true);
        user.setAccountLocked(true);
        user.setLockTime(LocalDateTime.now());

        User saved = userRepository.save(user);

        tokenBlacklistService.revokeUserTokens(userId);

        auditLogService.logAction("DEACTIVATE_USER", "User", userId.toString(),
            "User permanently deactivated by SUPER_ADMIN: " + user.getEmail(), userId);
        log.warn("User permanently deactivated: {} ({})", userId, user.getEmail());

        return mapToUserResponse(saved);
    }

    @Transactional
    public void resetPassword(Long userId, String newPassword) {
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new RuntimeException("User not found"));

        user.setPasswordHash(passwordEncoder.encode(newPassword));
        user.setFailedLoginAttempts(0);
        user.setAccountLocked(false);
        userRepository.save(user);

        tokenBlacklistService.revokeUserTokens(userId);

        auditLogService.logAction("RESET_PASSWORD", "User", null,
            "Password reset by admin", userId);

        log.info("Password reset for user: {}", userId);
    }

    @Transactional
    public void changePassword(Long userId, String currentPassword, String newPassword) {
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new RuntimeException("User not found"));

        if (!passwordEncoder.matches(currentPassword, user.getPasswordHash())) {
            throw new RuntimeException("Current password is incorrect");
        }

        user.setPasswordHash(passwordEncoder.encode(newPassword));
        user.setMustChangePassword(false);
        userRepository.save(user);

        tokenBlacklistService.revokeUserTokens(userId);

        auditLogService.logAction("CHANGE_PASSWORD", "User", user.getUserId().toString(),
            "User changed own password: " + user.getEmail(), userId);

        log.info("Password changed for user: {}", userId);
    }

    public Map<String, Object> getSettings() {
        Map<String, Object> defaults = new java.util.LinkedHashMap<>();
        defaults.put("companyName", "ProcurePro Inc.");
        defaults.put("taxId", "");
        defaults.put("timezone", "UTC");
        defaults.put("currency", "USD");
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

    // ─── Vendor approval ─────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<UserResponse> getPendingVendorApprovals() {
        return userRepository.findAll().stream()
            .filter(u -> "PENDING_APPROVAL".equals(u.getApprovalStatus())
                && u.getRole() != null
                && VENDOR_ROLES.contains(u.getRole().getRoleName()))
            .map(this::mapToUserResponse)
            .collect(Collectors.toList());
    }

    @Transactional
    public UserResponse approveVendor(Long userId) {
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new RuntimeException("User not found"));
        if (!"PENDING_APPROVAL".equals(user.getApprovalStatus())) {
            throw new RuntimeException("User is not pending approval");
        }
        user.setApprovalStatus("APPROVED");
        user.setAccountLocked(false);
        User saved = userRepository.save(user);

        // If the vendor's tenant was auto-created (TRIAL), activate it now
        Tenant tenant = user.getTenant();
        if (tenant != null && tenant.getStatus() == Tenant.TenantStatus.TRIAL) {
            tenant.setStatus(Tenant.TenantStatus.ACTIVE);
            tenantRepository.save(tenant);
            log.info("Activated TRIAL tenant '{}' upon vendor approval", tenant.getDomain());
        }
        auditLogService.logAction("APPROVE_VENDOR", "User", userId.toString(),
            "Vendor approved: " + user.getEmail(), userId);
        log.info("Vendor approved: {}", user.getEmail());
        sendVendorStatusEmail(user, true);
        return mapToUserResponse(saved);
    }

    @Transactional
    public UserResponse rejectVendor(Long userId) {
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new RuntimeException("User not found"));
        if (!"PENDING_APPROVAL".equals(user.getApprovalStatus())) {
            throw new RuntimeException("User is not pending approval");
        }
        user.setApprovalStatus("REJECTED");
        User saved = userRepository.save(user);
        auditLogService.logAction("REJECT_VENDOR", "User", userId.toString(),
            "Vendor rejected: " + user.getEmail(), userId);
        log.info("Vendor rejected: {}", user.getEmail());
        sendVendorStatusEmail(user, false);
        return mapToUserResponse(saved);
    }

    @Transactional
    public UserResponse inviteTeamMember(Long inviterId, com.procurement.authservice.dto.InviteRequest request) {
        User inviter = userRepository.findById(inviterId)
            .orElseThrow(() -> new RuntimeException("Inviting user not found"));

        if (!List.of("VENDOR_SALES", "VENDOR_FINANCE").contains(request.getRoleName())) {
            throw new RuntimeException("Invalid role for team invitation. Must be VENDOR_SALES or VENDOR_FINANCE.");
        }

        Tenant tenant = inviter.getTenant();
        if (userRepository.existsByEmailAndTenant(request.getEmail(), tenant)) {
            throw new RuntimeException("Email already registered in this organisation");
        }

        Role role = roleRepository.findByRoleName(request.getRoleName())
            .orElseThrow(() -> new RuntimeException("Role not found: " + request.getRoleName()));

        String tempPassword = generateTempPassword();
        User user = new User();
        user.setTenant(tenant);
        user.setFullName(request.getFullName());
        user.setEmail(request.getEmail());
        user.setPasswordHash(passwordEncoder.encode(tempPassword));
        user.setPhoneNumber(request.getPhoneNumber());
        user.setCompanyName(inviter.getCompanyName());
        user.setRole(role);
        user.setRegistrationDate(LocalDateTime.now());
        user.setAccountLocked(false);
        user.setApprovalStatus("APPROVED");
        user.setMustChangePassword(true);
        user.setFailedLoginAttempts(0);

        User saved = userRepository.save(user);
        sendInvitationEmail(inviter, saved, tempPassword, request.getRoleName());
        auditLogService.logAction("INVITE_TEAM_MEMBER", "User", saved.getUserId().toString(),
            "Invited by " + inviter.getEmail() + " with role " + request.getRoleName(), inviterId);
        log.info("Team member invited: {} as {} in tenant {}", saved.getEmail(), request.getRoleName(), tenant.getDomain());
        return mapToUserResponse(saved);
    }

    private String generateTempPassword() {
        String chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#";
        StringBuilder sb = new StringBuilder(12);
        java.util.Random rng = new java.util.Random();
        for (int i = 0; i < 12; i++) sb.append(chars.charAt(rng.nextInt(chars.length())));
        return sb.toString();
    }

    private void sendInvitationEmail(User inviter, User invited, String tempPassword, String roleName) {
        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setTo(invited.getEmail());
            message.setSubject("You've been invited to join " + inviter.getCompanyName() + " on ProcurePro");
            message.setText(
                "Hello " + invited.getFullName() + ",\n\n" +
                inviter.getFullName() + " has invited you to join " + inviter.getCompanyName() +
                " on ProcurePro as " + roleLabel(roleName) + ".\n\n" +
                "Sign in at: " + frontendUrl + "/login\n" +
                "Your email: " + invited.getEmail() + "\n" +
                "Temporary password: " + tempPassword + "\n\n" +
                "You will be prompted to set a new password on first login.\n\n" +
                "Best regards,\nProcurePro Team"
            );
            mailSender.send(message);
        } catch (Exception e) {
            log.error("Failed to send invitation email to {}: {}", invited.getEmail(), e.getMessage());
        }
    }

    private String roleLabel(String roleName) {
        return switch (roleName) {
            case "VENDOR_SALES" -> "Sales Representative";
            case "VENDOR_FINANCE" -> "Finance / Invoicing";
            default -> roleName;
        };
    }

    private void sendVendorStatusEmail(User user, boolean approved) {
        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setTo(user.getEmail());
            String company = user.getCompanyName() != null ? user.getCompanyName() : user.getFullName();
            if (approved) {
                message.setSubject("Vendor Registration Approved - ProcurePro");
                message.setText(
                    "Hello " + user.getFullName() + ",\n\n" +
                    "Great news! Your vendor registration for " + company + " has been approved.\n\n" +
                    "You can now sign in and complete your vendor profile:\n" +
                    frontendUrl + "/login\n\n" +
                    "Once logged in, you will be able to:\n" +
                    "  - Receive and respond to RFQs\n" +
                    "  - Submit competitive quotations\n" +
                    "  - Track purchase orders and deliveries\n\n" +
                    "Best regards,\nProcurePro Team"
                );
            } else {
                message.setSubject("Vendor Registration Update - ProcurePro");
                message.setText(
                    "Hello " + user.getFullName() + ",\n\n" +
                    "We have reviewed your vendor registration for " + company + " and are unable to approve it at this time.\n\n" +
                    "If you believe this is an error or would like more information, please contact the system administrator.\n\n" +
                    "Best regards,\nProcurePro Team"
                );
            }
            mailSender.send(message);
            log.info("Vendor {} email sent to: {}", approved ? "approval" : "rejection", user.getEmail());
        } catch (Exception e) {
            log.error("Failed to send vendor status email to {}: {}", user.getEmail(), e.getMessage());
        }
    }

    // ─── Tenant switching ────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<TenantSummary> getMyTenants(Long userId) {
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new RuntimeException("User not found"));
        return userRepository.findAllByEmail(user.getEmail()).stream()
            .map(u -> {
                Tenant t = u.getTenant();
                return TenantSummary.builder()
                    .tenantId(t.getTenantId())
                    .name(t.getName())
                    .domain(t.getDomain())
                    .status(t.getStatus().name())
                    .build();
            })
            .collect(Collectors.toList());
    }

    @Transactional
    public LoginResponse switchTenant(String targetDomain, Long currentUserId) {
        User currentUser = userRepository.findById(currentUserId)
            .orElseThrow(() -> new RuntimeException("User not found"));

        Tenant targetTenant = tenantRepository.findByDomain(targetDomain)
            .filter(t -> t.getStatus() == Tenant.TenantStatus.ACTIVE || t.getStatus() == Tenant.TenantStatus.TRIAL)
            .orElseThrow(() -> new TenantAccessException("Tenant not found or inactive: " + targetDomain));

        User targetUser = userRepository.findByEmailAndTenant(currentUser.getEmail(), targetTenant)
            .orElseThrow(() -> new TenantAccessException("You do not have access to tenant: " + targetDomain));

        String defaultContext = operatingContextService.defaultContext(targetUser, targetTenant);
        LoginResponse response = issueSessionToken(targetUser, targetTenant, defaultContext);

        auditLogService.logAction("SWITCH_TENANT", "User", targetUser.getUserId().toString(),
            "Switched to tenant: " + targetDomain, currentUserId);

        return response;
    }

    // ─── Tenant resolution helpers ──────────────────────────────────────────────

    private Tenant resolveTenantForLogin(LoginRequest request) {
        if (StringUtils.hasText(request.getTenantDomain())) {
            return tenantRepository.findByDomain(request.getTenantDomain())
                .filter(t -> t.getStatus() == Tenant.TenantStatus.ACTIVE || t.getStatus() == Tenant.TenantStatus.TRIAL)
                .orElseThrow(() -> new TenantAccessException("Tenant not found or inactive: " + request.getTenantDomain()));
        }
        // Derive from email domain as fallback
        String emailDomain = request.getEmail().substring(request.getEmail().indexOf('@') + 1);
        return tenantRepository.findByDomain(emailDomain)
            .filter(t -> t.getStatus() != Tenant.TenantStatus.SUSPENDED)
            .orElseGet(this::getDefaultTenant);
    }

    private Tenant resolveOrDefaultTenant(String tenantDomain) {
        if (StringUtils.hasText(tenantDomain)) {
            return tenantRepository.findByDomain(tenantDomain)
                .filter(t -> t.getStatus() != Tenant.TenantStatus.SUSPENDED)
                .orElseThrow(() -> new RuntimeException(
                    "Organisation domain '" + tenantDomain + "' not found. " +
                    "Please use the registration link provided by the organisation you are joining."));
        }
        return getDefaultTenant();
    }

    private static final java.util.Set<String> RESERVED_DOMAINS = java.util.Set.of(
        "gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "icloud.com",
        "protonmail.com", "zoho.com", "aol.com", "mail.com",
        "default", "system", "admin", "localhost", "procurepro", "procurement"
    );

    private void validateTenantDomain(String domain) {
        String lower = domain.trim().toLowerCase();
        if (RESERVED_DOMAINS.contains(lower)) {
            throw new RuntimeException(
                "Domain '" + domain + "' is reserved and cannot be used for company registration. " +
                "Please use your company's own domain (e.g., acme.com).");
        }
        if (!lower.matches("^[a-z0-9]([a-z0-9\\-]{0,61}[a-z0-9])?(\\.[a-z]{2,})+$")) {
            throw new RuntimeException(
                "Invalid domain format '" + domain + "'. Please use a valid domain like 'acme.com'.");
        }
    }

    private Tenant resolveOrCreateTenant(String tenantDomain, String companyName) {
        if (!StringUtils.hasText(tenantDomain)) {
            return getDefaultTenant();
        }
        validateTenantDomain(tenantDomain);
        return tenantRepository.findByDomain(tenantDomain)
            .filter(t -> t.getStatus() != Tenant.TenantStatus.SUSPENDED)
            .orElseGet(() -> {
                String name = StringUtils.hasText(companyName) ? companyName : tenantDomain;
                Tenant newTenant = Tenant.builder()
                    .name(name)
                    .domain(tenantDomain)
                    .status(Tenant.TenantStatus.TRIAL)
                    .subscriptionPlan(Tenant.SubscriptionPlan.BASIC)
                    .organizationType(com.procurement.authservice.domain.OrganizationType.SUPPLIER)
                    .build();
                Tenant saved = tenantRepository.save(newTenant);
                log.info("Auto-created TRIAL tenant '{}' for vendor self-registration", tenantDomain);
                return saved;
            });
    }

    public Tenant getDefaultTenant() {
        return tenantRepository.findByDomain("default")
            .orElseThrow(() -> new RuntimeException("Default tenant not configured"));
    }

    // ─── Mapping ────────────────────────────────────────────────────────────────

    private Object parseBoolean(String value) {
        if (value == null) return false;
        return Boolean.parseBoolean(value);
    }

    private UserResponse mapToUserResponse(User user) {
        Tenant tenant = user.getTenant();
        List<String> contexts = tenant != null
            ? operatingContextService.availableContexts(user, tenant)
            : List.of();
        return UserResponse.builder()
            .userId(user.getUserId())
            .fullName(user.getFullName())
            .email(user.getEmail())
            .phoneNumber(user.getPhoneNumber())
            .roleName(user.getRole().getRoleName())
            .supplierRoleName(user.getSupplierRole() != null ? user.getSupplierRole().getRoleName() : null)
            .organizationType(tenant != null && tenant.getOrganizationType() != null
                ? tenant.getOrganizationType().name() : null)
            .availableContexts(contexts)
            .lastLogin(user.getLastLogin())
            .registrationDate(user.getRegistrationDate())
            .active(!Boolean.TRUE.equals(user.getAccountLocked()) && !Boolean.TRUE.equals(user.getDeactivated()))
            .accountLocked(Boolean.TRUE.equals(user.getAccountLocked()))
            .deactivated(Boolean.TRUE.equals(user.getDeactivated()))
            .tenantId(tenant != null ? tenant.getTenantId() : null)
            .tenantName(tenant != null ? tenant.getName() : null)
            .approvalStatus(user.getApprovalStatus())
            .companyName(user.getCompanyName())
            .build();
    }
}
