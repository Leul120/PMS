package com.procurement.notificationservice.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class NotificationRequest {
    @NotNull
    private Long userId;
    
    @NotBlank
    private String type; // EMAIL, IN_APP, SMS
    
    @NotBlank
    private String title;
    
    @NotBlank
    private String message;
    
    private String category; // BID_DEADLINE, APPROVAL_PENDING, etc.
    
    private Long relatedEntityId;
}
