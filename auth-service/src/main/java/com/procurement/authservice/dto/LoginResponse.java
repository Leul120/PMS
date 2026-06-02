package com.procurement.authservice.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LoginResponse {
    private String accessToken;
    private String tokenType;
    private Long userId;
    private String email;
    private String fullName;
    /** Effective role for this session (may differ from procurement role in SALES context). */
    private String role;
    /** Primary procurement-side role stored on the user record. */
    private String procurementRole;
    private String supplierRole;
    private Long tenantId;
    private String tenantName;
    private String tenantDomain;
    private String organizationType;
    private String operatingContext;
    private List<String> availableContexts;
    private Boolean mustChangePassword;
}
