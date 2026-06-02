package com.procurement.authservice.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CreateUserRequest {
    
    @NotBlank(message = "Full name is required")
    private String fullName;
    
    @NotBlank(message = "Email is required")
    @Email(message = "Invalid email format")
    private String email;
    
    @NotBlank(message = "Password is required")
    @Size(min = 6, message = "Password must be at least 6 characters")
    private String password;
    
    private String phoneNumber;
    
    @NotBlank(message = "Role name is required")
    private String roleName;  // ADMIN, OFFICER, MANAGER, AUDITOR, VENDOR_*

    /** Optional supplier role for BOTH organisations (VENDOR_SALES, VENDOR_LOGISTICS, etc.). */
    private String supplierRoleName;

    /** SUPER_ADMIN only — target tenant for cross-tenant user creation. Ignored for other roles. */
    private Long tenantId;
}
