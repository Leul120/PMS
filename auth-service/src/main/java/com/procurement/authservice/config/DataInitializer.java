package com.procurement.authservice.config;

import com.procurement.authservice.domain.OrganizationType;
import com.procurement.authservice.entity.AuditLog;
import com.procurement.authservice.entity.Role;
import com.procurement.authservice.entity.SystemSettings;
import com.procurement.authservice.entity.Tenant;
import com.procurement.authservice.entity.User;
import com.procurement.authservice.repository.AuditLogRepository;
import com.procurement.authservice.repository.RoleRepository;
import com.procurement.authservice.repository.SystemSettingsRepository;
import com.procurement.authservice.repository.TenantRepository;
import com.procurement.authservice.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.Map;

@Component
@Order(1)
@RequiredArgsConstructor
@Slf4j
public class DataInitializer implements CommandLineRunner {

    private final RoleRepository roleRepository;
    private final UserRepository userRepository;
    private final TenantRepository tenantRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuditLogRepository auditLogRepository;
    private final SystemSettingsRepository systemSettingsRepository;

    @Override
    public void run(String... args) {
        migrateOrganizationTypes();
        Tenant defaultTenant = initDefaultTenant();
        Tenant systemTenant  = initSystemTenant();
        initRoles();
        initUsers(defaultTenant, systemTenant);
        initSystemSettings();
        initAuditLogs(defaultTenant.getTenantId());
        initDualHatDemoUsers(defaultTenant);
    }

    // ─── Tenants ──────────────────────────────────────────────────────────────

    private Tenant initDefaultTenant() {
        return tenantRepository.findByDomain("default").orElseGet(() -> {
            Tenant t = Tenant.builder()
                .name("Default Organization")
                .domain("default")
                .status(Tenant.TenantStatus.ACTIVE)
                .subscriptionPlan(Tenant.SubscriptionPlan.ENTERPRISE)
                .organizationType(OrganizationType.BOTH)
                .settings(Map.of("currency", "USD", "timezone", "UTC", "maxUsers", 1000))
                .build();
            Tenant saved = tenantRepository.save(t);
            log.info("Default tenant created: {}", saved.getTenantId());
            return saved;
        });
    }

    private void migrateOrganizationTypes() {
        tenantRepository.findAll().forEach(t -> {
            if (t.getOrganizationType() == null) {
                if ("default".equals(t.getDomain())) {
                    t.setOrganizationType(OrganizationType.BOTH);
                } else if ("system".equals(t.getDomain())) {
                    t.setOrganizationType(OrganizationType.BUYER);
                } else {
                    t.setOrganizationType(OrganizationType.SUPPLIER);
                }
                tenantRepository.save(t);
            } else if ("default".equals(t.getDomain()) && t.getOrganizationType() != OrganizationType.BOTH) {
                t.setOrganizationType(OrganizationType.BOTH);
                tenantRepository.save(t);
            }
        });
    }

    private void initDualHatDemoUsers(Tenant defaultTenant) {
        roleRepository.findByRoleName("VENDOR_SALES").ifPresent(salesRole ->
            userRepository.findByEmailAndTenant("alice@procurement.com", defaultTenant).ifPresent(alice -> {
                if (alice.getSupplierRole() == null) {
                    alice.setSupplierRole(salesRole);
                    userRepository.save(alice);
                    log.info("Assigned supplier role VENDOR_SALES to alice@procurement.com for dual-hat demo");
                }
            }));
    }

    private Tenant initSystemTenant() {
        return tenantRepository.findByDomain("system").orElseGet(() -> {
            Tenant t = Tenant.builder()
                .name("System")
                .domain("system")
                .status(Tenant.TenantStatus.ACTIVE)
                .subscriptionPlan(Tenant.SubscriptionPlan.ENTERPRISE)
                .organizationType(OrganizationType.BUYER)
                .settings(Map.of("internal", true))
                .build();
            Tenant saved = tenantRepository.save(t);
            log.info("System tenant created: {}", saved.getTenantId());
            return saved;
        });
    }

    // ─── Roles ────────────────────────────────────────────────────────────────

    private void initRoles() {
        upsertRole(1L, "ADMIN",         "MANAGE_USERS,VIEW_AUDIT,MANAGE_ROLES,MANAGE_RFQ,MANAGE_VENDOR,VIEW_REPORTS,APPROVE_PO,VIEW_COMPLIANCE,MANAGE_INVENTORY,MANAGE_SETTINGS");
        upsertRole(2L, "OFFICER",       "MANAGE_RFQ,MANAGE_VENDOR,VIEW_REPORTS,EVALUATE_BID,CREATE_PO,VALIDATE_INVOICE,MANAGE_DELIVERY,MANAGE_INVENTORY,VIEW_USERS");
        upsertRole(3L, "MANAGER",       "APPROVE_PO,CREATE_PO,VIEW_REPORTS,VIEW_VENDOR,VIEW_RFQ,VIEW_INVOICE,VIEW_DELIVERY,VIEW_INVENTORY,VIEW_USERS");
        upsertRole(4L, "VENDOR_ADMIN",  "SUBMIT_BID,VIEW_RFQ,SUBMIT_INVOICE,RECORD_DELIVERY,VIEW_OWN_DATA,MANAGE_TEAM,MANAGE_COMPANY");
        upsertRole(5L, "AUDITOR",       "VIEW_AUDIT,VIEW_REPORTS,VIEW_COMPLIANCE,READ_ALL,VIEW_USERS");
        upsertRole(6L, "DIRECTOR",      "APPROVE_PO,VIEW_REPORTS,VIEW_VENDOR,VIEW_RFQ,VIEW_INVOICE,VIEW_DELIVERY,VIEW_INVENTORY,VIEW_USERS,MANAGE_SETTINGS");
        upsertRole(7L, "SUPER_ADMIN",   "MANAGE_USERS,VIEW_AUDIT,MANAGE_ROLES,MANAGE_RFQ,MANAGE_VENDOR,VIEW_REPORTS,APPROVE_PO,VIEW_COMPLIANCE,MANAGE_INVENTORY,MANAGE_SETTINGS,MANAGE_TENANTS,READ_ALL,CREATE_PO,VALIDATE_INVOICE,MANAGE_DELIVERY,VIEW_USERS,SUPER_ADMIN");
        upsertRole(8L, "VENDOR_SALES",  "SUBMIT_BID,VIEW_RFQ,VIEW_OWN_DATA");
        upsertRole(9L, "VENDOR_FINANCE","SUBMIT_INVOICE,RECORD_DELIVERY,VIEW_OWN_DATA");
        upsertRole(10L, "REQUESTER",     "CREATE_REQUISITION,VIEW_OWN_DATA");
        upsertRole(11L, "VENDOR_LOGISTICS", "RECORD_DELIVERY,VIEW_RFQ,VIEW_OWN_DATA");
        log.info("Roles initialized");
    }

    private void upsertRole(Long id, String name, String permissions) {
        Role role = roleRepository.findById(id).orElse(new Role());
        role.setRoleId(id);
        role.setRoleName(name);
        role.setPermissions(permissions);
        roleRepository.save(role);
    }

    // ─── Users ────────────────────────────────────────────────────────────────

    private void initUsers(Tenant defaultTenant, Tenant systemTenant) {
        Role superAdminRole = roleRepository.findByRoleName("SUPER_ADMIN").orElseThrow();
        Role adminRole      = roleRepository.findByRoleName("ADMIN").orElseThrow();
        Role officerRole    = roleRepository.findByRoleName("OFFICER").orElseThrow();
        Role managerRole    = roleRepository.findByRoleName("MANAGER").orElseThrow();
        Role vendorRole     = roleRepository.findByRoleName("VENDOR_ADMIN").orElseThrow();
        Role auditorRole    = roleRepository.findByRoleName("AUDITOR").orElseThrow();
        Role directorRole   = roleRepository.findByRoleName("DIRECTOR").orElseThrow();
        Role requesterRole  = roleRepository.findByRoleName("REQUESTER").orElseThrow();

        // Super admin always ensured — checked by email, not by count
        createUserIfAbsent("Super Administrator",  "superadmin@system.local",  "+1-555-0001", "SuperAdmin@123", superAdminRole, LocalDateTime.now().minusDays(100), systemTenant);

        // Default tenant demo users — only seeded on a fresh database
        if (userRepository.countByTenant(defaultTenant) == 0) {
            createUserIfAbsent("System Administrator", "admin@procurement.com",    "+1-555-0100", "admin123",    adminRole,    LocalDateTime.now().minusDays(90),  defaultTenant);
            createUserIfAbsent("Alice Johnson",        "alice@procurement.com",    "+1-555-0101", "officer123",  officerRole,  LocalDateTime.now().minusDays(80),  defaultTenant);
            createUserIfAbsent("Bob Martinez",         "bob@procurement.com",      "+1-555-0102", "officer123",  officerRole,  LocalDateTime.now().minusDays(75),  defaultTenant);
            createUserIfAbsent("Carol Williams",       "carol@procurement.com",    "+1-555-0201", "manager123",  managerRole,  LocalDateTime.now().minusDays(70),  defaultTenant);
            createUserIfAbsent("David Chen",           "david@procurement.com",    "+1-555-0202", "manager123",  managerRole,  LocalDateTime.now().minusDays(65),  defaultTenant);
            createUserIfAbsent("TechSupply Corp",      "vendor1@techsupply.com",   "+1-555-0301", "vendor123",   vendorRole,   LocalDateTime.now().minusDays(60),  defaultTenant);
            createUserIfAbsent("BuildRight Ltd",       "vendor2@buildright.com",   "+1-555-0302", "vendor123",   vendorRole,   LocalDateTime.now().minusDays(55),  defaultTenant);
            createUserIfAbsent("OfficeEssentials Inc", "vendor3@officeess.com",    "+1-555-0303", "vendor123",   vendorRole,   LocalDateTime.now().minusDays(50),  defaultTenant);
            createUserIfAbsent("ElectroWorld Co",      "vendor4@electroworld.com", "+1-555-0304", "vendor123",   vendorRole,   LocalDateTime.now().minusDays(45),  defaultTenant);
            createUserIfAbsent("FurniturePlus LLC",    "vendor5@furnitureplus.com","+1-555-0305", "vendor123",   vendorRole,   LocalDateTime.now().minusDays(40),  defaultTenant);
            createUserIfAbsent("Eve Thompson",         "eve@procurement.com",      "+1-555-0401", "auditor123",  auditorRole,  LocalDateTime.now().minusDays(35),  defaultTenant);
            createUserIfAbsent("Frank Director",       "director@procurement.com", "+1-555-0250", "director123", directorRole, LocalDateTime.now().minusDays(60),  defaultTenant);
            createUserIfAbsent("Grace Requester",      "requester@procurement.com","+1-555-0150", "requester123", requesterRole, LocalDateTime.now().minusDays(30), defaultTenant);
            log.info("Seed users created");
        }
    }

    private User createUserIfAbsent(String fullName, String email, String phone,
                                    String rawPassword, Role role, LocalDateTime regDate,
                                    Tenant tenant) {
        if (userRepository.existsByEmailAndTenant(email, tenant)) {
            return userRepository.findByEmailAndTenant(email, tenant).orElseThrow();
        }
        User u = new User();
        u.setTenant(tenant);
        u.setFullName(fullName);
        u.setEmail(email);
        u.setPhoneNumber(phone);
        u.setPasswordHash(passwordEncoder.encode(rawPassword));
        u.setRole(role);
        u.setRegistrationDate(regDate);
        u.setLastLogin(regDate.plusDays(1));
        u.setFailedLoginAttempts(0);
        u.setAccountLocked(false);
        return userRepository.save(u);
    }

    // ─── System Settings ──────────────────────────────────────────────────────

    private void initSystemSettings() {
        if (systemSettingsRepository.count() == 0) {
            createSetting("MAX_LOGIN_ATTEMPTS",      "5",                    "SECURITY", null);
            createSetting("LOCK_DURATION_MINUTES",   "30",                   "SECURITY", null);
            createSetting("SESSION_TIMEOUT_MINUTES", "480",                  "SECURITY", null);
            createSetting("EMAIL_NOTIFICATIONS",     "true",                 "NOTIFICATION", null);
            createSetting("IN_APP_NOTIFICATIONS",    "true",                 "NOTIFICATION", null);
            createSetting("BID_DEADLINE_REMINDER_HOURS", "24",               "NOTIFICATION", null);
            createSetting("COMPANY_NAME",            "Procurement Corp",     "SYSTEM", null);
            createSetting("FISCAL_YEAR_START",       "01-01",                "SYSTEM", null);
            createSetting("DEFAULT_CURRENCY",        "USD",                  "SYSTEM", null);
            createSetting("PO_APPROVAL_THRESHOLD",   "10000",                "SYSTEM", null);
            log.info("System settings initialized");
        }
    }

    private void createSetting(String key, String value, String category, Long userId) {
        SystemSettings s = new SystemSettings();
        s.setSettingKey(key);
        s.setSettingValue(value);
        s.setCategory(category);
        s.setUserId(userId);
        systemSettingsRepository.save(s);
    }

    // ─── Audit Logs ───────────────────────────────────────────────────────────

    private void initAuditLogs(Long tenantId) {
        if (auditLogRepository.count() == 0) {
            Long adminId  = userRepository.findByEmail("admin@procurement.com").map(User::getUserId).orElse(1L);
            Long aliceId  = userRepository.findByEmail("alice@procurement.com").map(User::getUserId).orElse(2L);
            Long bobId    = userRepository.findByEmail("bob@procurement.com").map(User::getUserId).orElse(3L);
            Long carolId  = userRepository.findByEmail("carol@procurement.com").map(User::getUserId).orElse(4L);
            Long davidId  = userRepository.findByEmail("david@procurement.com").map(User::getUserId).orElse(5L);

            createAuditLog("USER_CREATED", "User", LocalDateTime.now().minusDays(80), null,
                    "{\"email\":\"alice@procurement.com\",\"role\":\"OFFICER\"}", adminId, tenantId);
            createAuditLog("USER_CREATED", "User", LocalDateTime.now().minusDays(75), null,
                    "{\"email\":\"bob@procurement.com\",\"role\":\"OFFICER\"}", adminId, tenantId);
            createAuditLog("USER_CREATED", "User", LocalDateTime.now().minusDays(70), null,
                    "{\"email\":\"carol@procurement.com\",\"role\":\"MANAGER\"}", adminId, tenantId);
            createAuditLog("RFQ_CREATED", "RFQ", LocalDateTime.now().minusDays(60), null,
                    "{\"rfqId\":4,\"title\":\"Server Room Renovation\",\"status\":\"Open\"}", aliceId, tenantId);
            createAuditLog("RFQ_AWARDED", "RFQ", LocalDateTime.now().minusDays(55), null,
                    "{\"rfqId\":4,\"awardedVendorId\":2,\"bidAmount\":115000}", aliceId, tenantId);
            createAuditLog("RFQ_CREATED", "RFQ", LocalDateTime.now().minusDays(35), null,
                    "{\"rfqId\":3,\"title\":\"Annual Stationery Supply Contract\",\"status\":\"Open\"}", bobId, tenantId);
            createAuditLog("RFQ_CLOSED",  "RFQ", LocalDateTime.now().minusDays(5), null,
                    "{\"rfqId\":3,\"status\":\"Closed\",\"bidsReceived\":2}", bobId, tenantId);
            createAuditLog("PO_APPROVED", "PurchaseOrder", LocalDateTime.now().minusDays(54), null,
                    "{\"poId\":1,\"vendorId\":2,\"amount\":115000,\"status\":\"Approved\"}", carolId, tenantId);
            createAuditLog("PO_APPROVED", "PurchaseOrder", LocalDateTime.now().minusDays(14), null,
                    "{\"poId\":2,\"vendorId\":3,\"amount\":11200,\"status\":\"Approved\"}", carolId, tenantId);
            createAuditLog("PO_CLOSED", "PurchaseOrder", LocalDateTime.now().minusDays(5), null,
                    "{\"poId\":1,\"reason\":\"Delivery confirmed, invoice paid, three-way match passed\"}", carolId, tenantId);
            createAuditLog("DISPUTE_RAISED",   "Dispute", LocalDateTime.now().minusDays(27), null,
                    "{\"disputeId\":1,\"poId\":5,\"type\":\"QUANTITY_MISMATCH\",\"raisedBy\":3}", bobId, tenantId);
            createAuditLog("DISPUTE_RESOLVED", "Dispute", LocalDateTime.now().minusDays(21), null,
                    "{\"disputeId\":1,\"resolution\":\"Revised invoice issued for $9720\"}", carolId, tenantId);
            createAuditLog("LOGIN", "User", LocalDateTime.now().minusDays(5),
                    "{\"status\":\"SUCCESS\"}", null, aliceId, tenantId);
            createAuditLog("LOGIN", "User", LocalDateTime.now().minusDays(3),
                    "{\"status\":\"SUCCESS\"}", null, bobId, tenantId);
            createAuditLog("LOGIN", "User", LocalDateTime.now().minusDays(1),
                    "{\"status\":\"SUCCESS\"}", null, carolId, tenantId);
            createAuditLog("LOGIN", "User", LocalDateTime.now().minusDays(2),
                    "{\"status\":\"SUCCESS\"}", null, davidId, tenantId);
            createAuditLog("ROLE_UPDATED", "Role", LocalDateTime.now().minusDays(3),
                    "{\"roleName\":\"OFFICER\",\"permissions\":\"old\"}", "{\"roleName\":\"OFFICER\",\"permissions\":\"new\"}", adminId, tenantId);

            log.info("Audit logs initialized");
        }
    }

    private void createAuditLog(String actionType, String entity, LocalDateTime timestamp,
                                 String oldValue, String newValue, Long userId, Long tenantId) {
        AuditLog log2 = new AuditLog();
        log2.setTenantId(tenantId);
        log2.setActionType(actionType);
        log2.setEntityAffected(entity);
        log2.setTimestamp(timestamp);
        log2.setOldValue(oldValue);
        log2.setNewValue(newValue);
        log2.setUserId(userId);
        auditLogRepository.save(log2);
    }
}
