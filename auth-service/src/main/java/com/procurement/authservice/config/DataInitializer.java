package com.procurement.authservice.config;

import com.procurement.authservice.entity.AuditLog;
import com.procurement.authservice.entity.Role;
import com.procurement.authservice.entity.SystemSettings;
import com.procurement.authservice.entity.User;
import com.procurement.authservice.repository.AuditLogRepository;
import com.procurement.authservice.repository.RoleRepository;
import com.procurement.authservice.repository.SystemSettingsRepository;
import com.procurement.authservice.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;

@Component
@RequiredArgsConstructor
@Slf4j
public class DataInitializer implements CommandLineRunner {

    private final RoleRepository roleRepository;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuditLogRepository auditLogRepository;
    private final SystemSettingsRepository systemSettingsRepository;

    @Override
    public void run(String... args) {
        initRoles();
        initUsers();
        initSystemSettings();
        initAuditLogs();
    }

    // ─── Roles ────────────────────────────────────────────────────────────────

    private void initRoles() {
        if (roleRepository.count() == 0) {
            createRole(1L, "ADMIN",   "MANAGE_USERS,VIEW_AUDIT,MANAGE_ROLES,MANAGE_RFQ,MANAGE_VENDOR,VIEW_REPORTS,APPROVE_PO,VIEW_COMPLIANCE,MANAGE_INVENTORY,MANAGE_SETTINGS");
            createRole(2L, "OFFICER", "MANAGE_RFQ,MANAGE_VENDOR,VIEW_REPORTS,EVALUATE_BID,CREATE_PO,VALIDATE_INVOICE,MANAGE_DELIVERY,MANAGE_INVENTORY,VIEW_USERS");
            createRole(3L, "MANAGER", "APPROVE_PO,CREATE_PO,VIEW_REPORTS,VIEW_VENDOR,VIEW_RFQ,VIEW_INVOICE,VIEW_DELIVERY,VIEW_INVENTORY,VIEW_USERS");
            createRole(4L, "VENDOR",  "SUBMIT_BID,VIEW_RFQ,SUBMIT_INVOICE,RECORD_DELIVERY,VIEW_OWN_DATA");
            createRole(5L, "AUDITOR", "VIEW_AUDIT,VIEW_REPORTS,VIEW_COMPLIANCE,READ_ALL,VIEW_USERS");
            log.info("Roles initialized");
        }
    }

    private void createRole(Long id, String name, String permissions) {
        Role role = new Role();
        role.setRoleId(id);
        role.setRoleName(name);
        role.setPermissions(permissions);
        roleRepository.save(role);
    }

    // ─── Users ────────────────────────────────────────────────────────────────

    private void initUsers() {
        if (userRepository.count() <= 1) {   // only admin exists (or none)
            Role adminRole   = roleRepository.findByRoleName("ADMIN").orElseThrow();
            Role officerRole = roleRepository.findByRoleName("OFFICER").orElseThrow();
            Role managerRole = roleRepository.findByRoleName("MANAGER").orElseThrow();
            Role vendorRole  = roleRepository.findByRoleName("VENDOR").orElseThrow();
            Role auditorRole = roleRepository.findByRoleName("AUDITOR").orElseThrow();

            // Admin
            createUserIfAbsent("System Administrator",  "admin@procurement.com",    "+1-555-0100", "admin123",   adminRole,   LocalDateTime.now().minusDays(90));

            // Procurement Officers
            createUserIfAbsent("Alice Johnson",         "alice@procurement.com",    "+1-555-0101", "officer123", officerRole, LocalDateTime.now().minusDays(80));
            createUserIfAbsent("Bob Martinez",          "bob@procurement.com",      "+1-555-0102", "officer123", officerRole, LocalDateTime.now().minusDays(75));

            // Managers
            createUserIfAbsent("Carol Williams",        "carol@procurement.com",    "+1-555-0201", "manager123", managerRole, LocalDateTime.now().minusDays(70));
            createUserIfAbsent("David Chen",            "david@procurement.com",    "+1-555-0202", "manager123", managerRole, LocalDateTime.now().minusDays(65));

            // Vendors (user accounts linked to vendor profiles)
            createUserIfAbsent("TechSupply Corp",       "vendor1@techsupply.com",   "+1-555-0301", "vendor123",  vendorRole,  LocalDateTime.now().minusDays(60));
            createUserIfAbsent("BuildRight Ltd",        "vendor2@buildright.com",   "+1-555-0302", "vendor123",  vendorRole,  LocalDateTime.now().minusDays(55));
            createUserIfAbsent("OfficeEssentials Inc",  "vendor3@officeess.com",    "+1-555-0303", "vendor123",  vendorRole,  LocalDateTime.now().minusDays(50));
            createUserIfAbsent("ElectroWorld Co",       "vendor4@electroworld.com", "+1-555-0304", "vendor123",  vendorRole,  LocalDateTime.now().minusDays(45));
            createUserIfAbsent("FurniturePlus LLC",     "vendor5@furnitureplus.com","+1-555-0305", "vendor123",  vendorRole,  LocalDateTime.now().minusDays(40));

            // Auditors
            createUserIfAbsent("Eve Thompson",          "eve@procurement.com",      "+1-555-0401", "auditor123", auditorRole, LocalDateTime.now().minusDays(35));

            log.info("Seed users created");
        }
    }

    private User createUserIfAbsent(String fullName, String email, String phone,
                                    String rawPassword, Role role, LocalDateTime regDate) {
        if (userRepository.existsByEmail(email)) {
            return userRepository.findByEmail(email).orElseThrow();
        }
        User u = new User();
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

    private void initAuditLogs() {
        if (auditLogRepository.count() == 0) {
            Long adminId  = userRepository.findByEmail("admin@procurement.com").map(User::getUserId).orElse(1L);
            Long aliceId  = userRepository.findByEmail("alice@procurement.com").map(User::getUserId).orElse(2L);
            Long bobId    = userRepository.findByEmail("bob@procurement.com").map(User::getUserId).orElse(3L);
            Long carolId  = userRepository.findByEmail("carol@procurement.com").map(User::getUserId).orElse(4L);
            Long davidId  = userRepository.findByEmail("david@procurement.com").map(User::getUserId).orElse(5L);

            // User management
            createAuditLog("USER_CREATED", "User", LocalDateTime.now().minusDays(80), null,
                    "{\"email\":\"alice@procurement.com\",\"role\":\"OFFICER\"}", adminId);
            createAuditLog("USER_CREATED", "User", LocalDateTime.now().minusDays(75), null,
                    "{\"email\":\"bob@procurement.com\",\"role\":\"OFFICER\"}", adminId);
            createAuditLog("USER_CREATED", "User", LocalDateTime.now().minusDays(70), null,
                    "{\"email\":\"carol@procurement.com\",\"role\":\"MANAGER\"}", adminId);

            // RFQ lifecycle
            createAuditLog("RFQ_CREATED", "RFQ", LocalDateTime.now().minusDays(60), null,
                    "{\"rfqId\":4,\"title\":\"Server Room Renovation\",\"status\":\"Open\"}", aliceId);
            createAuditLog("RFQ_AWARDED", "RFQ", LocalDateTime.now().minusDays(55), null,
                    "{\"rfqId\":4,\"awardedVendorId\":2,\"bidAmount\":115000}", aliceId);
            createAuditLog("RFQ_CREATED", "RFQ", LocalDateTime.now().minusDays(35), null,
                    "{\"rfqId\":3,\"title\":\"Annual Stationery Supply Contract\",\"status\":\"Open\"}", bobId);
            createAuditLog("RFQ_CLOSED",  "RFQ", LocalDateTime.now().minusDays(5), null,
                    "{\"rfqId\":3,\"status\":\"Closed\",\"bidsReceived\":2}", bobId);

            // PO approvals
            createAuditLog("PO_APPROVED", "PurchaseOrder", LocalDateTime.now().minusDays(54), null,
                    "{\"poId\":1,\"vendorId\":2,\"amount\":115000,\"status\":\"Approved\"}", carolId);
            createAuditLog("PO_APPROVED", "PurchaseOrder", LocalDateTime.now().minusDays(14), null,
                    "{\"poId\":2,\"vendorId\":3,\"amount\":11200,\"status\":\"Approved\"}", carolId);
            createAuditLog("PO_APPROVED", "PurchaseOrder", LocalDateTime.now().minusDays(4), null,
                    "{\"poId\":4,\"vendorId\":1,\"amount\":72000,\"status\":\"Approved\"}", carolId);

            // PO status changes
            createAuditLog("PO_CLOSED", "PurchaseOrder", LocalDateTime.now().minusDays(5), null,
                    "{\"poId\":1,\"reason\":\"Delivery confirmed, invoice paid, three-way match passed\"}", carolId);
            createAuditLog("PO_CLOSED", "PurchaseOrder", LocalDateTime.now().minusDays(20), null,
                    "{\"poId\":5,\"reason\":\"Delivery completed, revised invoice paid after dispute resolution\"}", carolId);

            // Dispute actions
            createAuditLog("DISPUTE_RAISED",   "Dispute", LocalDateTime.now().minusDays(27), null,
                    "{\"disputeId\":1,\"poId\":5,\"type\":\"QUANTITY_MISMATCH\",\"raisedBy\":3}", bobId);
            createAuditLog("DISPUTE_RESOLVED", "Dispute", LocalDateTime.now().minusDays(21), null,
                    "{\"disputeId\":1,\"resolution\":\"Revised invoice issued for $9720\"}", carolId);

            // Login activity
            createAuditLog("LOGIN", "User", LocalDateTime.now().minusDays(5),
                    "{\"status\":\"SUCCESS\"}", null, aliceId);
            createAuditLog("LOGIN", "User", LocalDateTime.now().minusDays(3),
                    "{\"status\":\"SUCCESS\"}", null, bobId);
            createAuditLog("LOGIN", "User", LocalDateTime.now().minusDays(1),
                    "{\"status\":\"SUCCESS\"}", null, carolId);
            createAuditLog("LOGIN", "User", LocalDateTime.now().minusDays(2),
                    "{\"status\":\"SUCCESS\"}", null, davidId);

            // Settings change
            createAuditLog("ROLE_UPDATED", "Role", LocalDateTime.now().minusDays(3),
                    "{\"roleName\":\"OFFICER\",\"permissions\":\"old\"}", "{\"roleName\":\"OFFICER\",\"permissions\":\"new\"}", adminId);

            log.info("Audit logs initialized");
        }
    }

    private void createAuditLog(String actionType, String entity, LocalDateTime timestamp,
                                 String oldValue, String newValue, Long userId) {
        AuditLog log2 = new AuditLog();
        log2.setActionType(actionType);
        log2.setEntityAffected(entity);
        log2.setTimestamp(timestamp);
        log2.setOldValue(oldValue);
        log2.setNewValue(newValue);
        log2.setUserId(userId);
        auditLogRepository.save(log2);
    }
}
