package com.procurement.authservice.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "\"User\"")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class User {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long userId;
    
    private String fullName;
    
    @Column(unique = true)
    private String email;
    
    private String phoneNumber;
    
    private String passwordHash;
    
    @ManyToOne
    @JoinColumn(name = "roleId")
    private Role role;
    
    private LocalDateTime lastLogin;
    
    private LocalDateTime registrationDate;
    
    private Integer failedLoginAttempts = 0;
    
    private Boolean accountLocked = false;
    
    private LocalDateTime lockTime;
    
    private LocalDateTime lastFailedLogin;
}
