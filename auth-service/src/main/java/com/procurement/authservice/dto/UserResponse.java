package com.procurement.authservice.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserResponse {
    private Long userId;
    private String fullName;
    private String email;
    private String phoneNumber;
    private String roleName;
    /** Supplier-side role for dual-hat users (BOTH organisations). */
    private String supplierRoleName;
    private String organizationType;
    private List<String> availableContexts;
    private LocalDateTime lastLogin;
    private LocalDateTime registrationDate;
    private Boolean active;
    private Boolean accountLocked;
    private Boolean deactivated;
    private Long tenantId;
    private String tenantName;
    private String approvalStatus;
    private String companyName;
}
