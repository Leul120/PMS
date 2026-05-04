package com.procurement.authservice.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "\"Role\"")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Role {
    @Id
    private Long roleId;
    
    private String roleName;
    
    private String permissions;
}
