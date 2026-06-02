package com.procurement.authservice.service;

import com.procurement.authservice.dto.*;
import com.procurement.authservice.entity.Role;
import com.procurement.authservice.entity.Tenant;
import com.procurement.authservice.entity.User;
import com.procurement.authservice.repository.RoleRepository;
import com.procurement.authservice.repository.TenantRepository;
import com.procurement.authservice.repository.UserRepository;
import com.procurement.authservice.repository.UserSpecifications;
import com.procurement.authservice.tenant.TenantAccessException;
import com.procurement.authservice.tenant.TenantContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.security.core.context.SecurityContextHolder;
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
    private final TenantRepository tenantRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuditLogService auditLogService;
    private final OperatingContextService operatingContextService;

    @Transactional(readOnly = true)
    public PagedResponse<UserResponse> getUsers(
            int page,
            int size,
            String search,
            String role,
            String accountStatus,
            Long tenantId,
            String sort) {
        Specification<User> spec = UserSpecifications.combine(search, role, accountStatus, tenantId);
        Long currentTenantId = TenantContext.getCurrentTenant();
        if (currentTenantId != null) {
            spec = Specification.where(spec).and(
                (root, query, cb) -> cb.equal(root.get("tenant").get("tenantId"), currentTenantId));
        }
        Page<User> userPage = userRepository.findAll(
            spec, PageRequest.of(page, size, resolveUserSort(sort)));
        List<UserResponse> content = userPage.getContent().stream()
            .map(this::mapToUserResponse)
            .collect(Collectors.toList());
        return PagedResponse.<UserResponse>builder()
            .content(content)
            .page(userPage.getNumber())
            .size(userPage.getSize())
            .totalElements(userPage.getTotalElements())
            .totalPages(userPage.getTotalPages())
            .last(userPage.isLast())
            .build();
    }

    @Transactional(readOnly = true)
    public UserStatsResponse getUserStats() {
        Long currentTenantId = TenantContext.getCurrentTenant();
        Specification<User> scope = currentTenantId != null
            ? (root, query, cb) -> cb.equal(root.get("tenant").get("tenantId"), currentTenantId)
            : null;
        long total = scope != null ? userRepository.count(scope) : userRepository.count();
        long active = userRepository.count(Specification.where(scope).and(UserSpecifications.withAccountStatus("ACTIVE")));
        long locked = userRepository.count(Specification.where(scope).and(UserSpecifications.withAccountStatus("LOCKED")));
        long tenants = currentTenantId != null ? 1 : userRepository.countDistinctTenants();
        return UserStatsResponse.builder()
            .totalUsers(total)
            .activeUsers(active)
            .lockedUsers(locked)
            .tenantCount(tenants)
            .build();
    }

    private Sort resolveUserSort(String sort) {
        if (sort == null || sort.isBlank()) {
            return Sort.by(Sort.Direction.ASC, "fullName");
        }
        return switch (sort) {
            case "name-desc" -> Sort.by(Sort.Direction.DESC, "fullName");
            case "email-asc" -> Sort.by(Sort.Direction.ASC, "email");
            case "date-desc" -> Sort.by(Sort.Direction.DESC, "registrationDate");
            case "date-asc" -> Sort.by(Sort.Direction.ASC, "registrationDate");
            default -> Sort.by(Sort.Direction.ASC, "fullName");
        };
    }

    @Transactional(readOnly = true)
    public List<UserResponse> getAllUsers() {
        return getUsers(0, 500, null, null, null, null, "name-asc").getContent();
    }

    @Transactional(readOnly = true)
    public UserResponse getUser(Long userId) {
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new RuntimeException("User not found: " + userId));
        assertSameTenant(user);
        return mapToUserResponse(user);
    }

    @Transactional
    public UserResponse createUser(CreateUserRequest request, Long adminId) {
        boolean isSuperAdmin = SecurityContextHolder.getContext().getAuthentication() != null &&
            SecurityContextHolder.getContext().getAuthentication().getAuthorities()
                .stream().anyMatch(a -> "ROLE_SUPER_ADMIN".equals(a.getAuthority()));

        // Non-SUPER_ADMIN can only create users in their own tenant; ignore any tenantId in the request.
        Tenant tenant;
        if (request.getTenantId() != null && isSuperAdmin) {
            tenant = tenantRepository.findById(request.getTenantId())
                .orElseThrow(() -> new RuntimeException("Target tenant not found: " + request.getTenantId()));
        } else {
            tenant = resolveCurrentTenant();
        }

        if (userRepository.existsByEmailAndTenant(request.getEmail(), tenant)) {
            throw new RuntimeException("Email already registered in this tenant: " + request.getEmail());
        }

        Role role = roleRepository.findByRoleName(request.getRoleName())
            .orElseThrow(() -> new RuntimeException("Role not found: " + request.getRoleName()));
        Role supplierRole = resolveSupplierRole(request.getSupplierRoleName(), tenant, role);

        User user = new User();
        user.setTenant(tenant);
        user.setFullName(request.getFullName());
        user.setEmail(request.getEmail());
        user.setPasswordHash(passwordEncoder.encode(request.getPassword()));
        user.setPhoneNumber(request.getPhoneNumber());
        user.setRole(role);
        user.setSupplierRole(supplierRole);
        user.setRegistrationDate(LocalDateTime.now());
        user.setAccountLocked(false);
        user.setFailedLoginAttempts(0);
        user.setMustChangePassword(true); // Admin-created users must change their password on first login

        User savedUser = userRepository.save(user);

        auditLogService.logAction("CREATE_USER", "User", savedUser.getUserId().toString(),
            "Admin " + adminId + " created user " + savedUser.getEmail() + " with role " + role.getRoleName()
                + " in tenant " + tenant.getDomain(), adminId);

        log.info("User created by admin {}: {} (role={}, tenant={})", adminId, savedUser.getEmail(),
            role.getRoleName(), tenant.getDomain());

        return mapToUserResponse(savedUser);
    }

    @Transactional
    public UserResponse updateUser(Long userId, UpdateUserRequest request) {
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new RuntimeException("User not found: " + userId));
        assertSameTenant(user);

        if (request.getFullName() != null) user.setFullName(request.getFullName());
        if (request.getPhoneNumber() != null) user.setPhoneNumber(request.getPhoneNumber());
        if (request.getRoleName() != null && !request.getRoleName().isBlank()) {
            Role role = roleRepository.findByRoleName(request.getRoleName())
                .orElseThrow(() -> new RuntimeException("Role not found: " + request.getRoleName()));
            user.setRole(role);
        }
        if (request.getSupplierRoleName() != null) {
            if (request.getSupplierRoleName().isBlank()) {
                user.setSupplierRole(null);
            } else {
                user.setSupplierRole(resolveSupplierRole(request.getSupplierRoleName(), user.getTenant(), user.getRole()));
            }
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
        assertSameTenant(user);

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
        assertSameTenant(user);

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
        assertSameTenant(user);

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
        assertSameTenant(user);

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
        assertSameTenant(user);

        user.setPasswordHash(passwordEncoder.encode(newPassword));
        User updatedUser = userRepository.save(user);

        auditLogService.logAction("RESET_PASSWORD", "User", userId.toString(),
            "Password reset by admin", null);
        log.info("Password reset for user: {}", user.getEmail());
        return mapToUserResponse(updatedUser);
    }

    // ─── Tenant helpers ────────────────────────────────────────────────────────

    private Tenant resolveCurrentTenant() {
        Long tenantId = TenantContext.getCurrentTenant();
        if (tenantId != null) {
            return tenantRepository.findById(tenantId)
                .orElseThrow(() -> new TenantAccessException("Tenant not found: " + tenantId));
        }
        // Fallback to default tenant for system-level admin operations
        return tenantRepository.findByDomain("default")
            .orElseThrow(() -> new RuntimeException("Default tenant not configured"));
    }

    private void assertSameTenant(User user) {
        Long currentTenantId = TenantContext.getCurrentTenant();
        if (currentTenantId != null && user.getTenant() != null
                && !currentTenantId.equals(user.getTenant().getTenantId())) {
            throw new TenantAccessException("Access denied: user belongs to a different tenant");
        }
    }

    private Role resolveSupplierRole(String supplierRoleName, Tenant tenant, Role procurementRole) {
        if (supplierRoleName == null || supplierRoleName.isBlank()) {
            return null;
        }
        if (!operatingContextService.isBuyerRole(procurementRole.getRoleName())) {
            throw new RuntimeException("Supplier role assignment is only for procurement users on BOTH organisations");
        }
        var org = operatingContextService.resolveOrganizationType(tenant);
        if (org != com.procurement.authservice.domain.OrganizationType.BOTH) {
            throw new RuntimeException("Supplier role assignment requires a BOTH organisation type");
        }
        Role supplierRole = roleRepository.findByRoleName(supplierRoleName)
            .orElseThrow(() -> new RuntimeException("Role not found: " + supplierRoleName));
        if (!operatingContextService.isVendorRole(supplierRole.getRoleName())) {
            throw new RuntimeException("Supplier role must be a vendor role (e.g. VENDOR_SALES)");
        }
        return supplierRole;
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
            .active(!Boolean.TRUE.equals(user.getAccountLocked()))
            .accountLocked(Boolean.TRUE.equals(user.getAccountLocked()))
            .deactivated(Boolean.TRUE.equals(user.getDeactivated()))
            .tenantId(tenant != null ? tenant.getTenantId() : null)
            .tenantName(tenant != null ? tenant.getName() : null)
            .approvalStatus(user.getApprovalStatus())
            .companyName(user.getCompanyName())
            .build();
    }
}
