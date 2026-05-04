package com.procurement.authservice.config;

import com.procurement.authservice.entity.Role;
import com.procurement.authservice.entity.User;
import com.procurement.authservice.repository.RoleRepository;
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
    
    @Override
    public void run(String... args) {
        // Initialize roles
        if (roleRepository.count() == 0) {
            createRole(1L, "ADMIN", "MANAGE_USERS,VIEW_AUDIT,MANAGE_ROLES,MANAGE_RFQ,MANAGE_VENDOR,VIEW_REPORTS,APPROVE_PO,VIEW_COMPLIANCE");
            createRole(2L, "OFFICER", "MANAGE_RFQ,MANAGE_VENDOR,VIEW_REPORTS,EVALUATE_BID,CREATE_PO");
            createRole(3L, "MANAGER", "APPROVE_PO,VIEW_REPORTS,VIEW_VENDOR,VIEW_RFQ");
            createRole(4L, "VENDOR", "SUBMIT_BID,VIEW_RFQ,MANAGE_INVOICE,VIEW_OWN_DATA");
            createRole(5L, "AUDITOR", "VIEW_AUDIT,VIEW_REPORTS,VIEW_COMPLIANCE,READ_ALL");
            log.info("Roles initialized");
        }
        
        // Initialize admin user
        if (!userRepository.existsByEmail("admin@procurement.com")) {
            Role adminRole = roleRepository.findByRoleName("ADMIN")
                .orElseThrow(() -> new RuntimeException("Admin role not found"));
            
            User admin = new User();
            admin.setFullName("System Administrator");
            admin.setEmail("admin@procurement.com");
            admin.setPasswordHash(passwordEncoder.encode("admin123"));
            admin.setRole(adminRole);
            admin.setRegistrationDate(LocalDateTime.now());
            
            userRepository.save(admin);
            log.info("Admin user created: admin@procurement.com / admin123");
        }
    }
    
    private void createRole(Long id, String name, String permissions) {
        Role role = new Role();
        role.setRoleId(id);
        role.setRoleName(name);
        role.setPermissions(permissions);
        roleRepository.save(role);
    }
}
