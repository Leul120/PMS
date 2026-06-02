package com.procurement.authservice.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class LoginRequest {
    @NotBlank
    @Email
    private String email;

    @NotBlank
    private String password;

    /** Optional: tenant domain or tenantId for multi-tenant login. Defaults to default tenant. */
    private String tenantDomain;
}
