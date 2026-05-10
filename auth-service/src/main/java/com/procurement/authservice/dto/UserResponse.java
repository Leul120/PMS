package com.procurement.authservice.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

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
    private LocalDateTime lastLogin;
    private LocalDateTime registrationDate;
    // Frontend compatibility fields
    private Boolean active;
    private Boolean accountLocked;
}
