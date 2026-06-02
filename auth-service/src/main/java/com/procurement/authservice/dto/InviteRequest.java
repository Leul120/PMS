package com.procurement.authservice.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class InviteRequest {

    @NotBlank
    private String fullName;

    @NotBlank
    @Email
    private String email;

    /** VENDOR_SALES or VENDOR_FINANCE */
    @NotBlank
    private String roleName;

    private String phoneNumber;
}
