package com.procurement.authservice.dto;

import lombok.Data;

@Data
public class UpdateUserRequest {
    private String fullName;
    private String phoneNumber;
    private String email;
    private String roleName;
    /** Set to empty string to clear supplier role assignment. */
    private String supplierRoleName;
}
