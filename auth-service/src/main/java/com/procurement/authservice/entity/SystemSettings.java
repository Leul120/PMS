package com.procurement.authservice.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Key-value store for system-wide and per-user settings.
 * category: "SYSTEM" | "NOTIFICATION" | "SECURITY"
 * userId: null for system-wide settings, non-null for user-specific overrides.
 */
@Entity
@Table(name = "system_settings",
    uniqueConstraints = @UniqueConstraint(columnNames = {"settingKey", "category", "userId"}))
@Data
@NoArgsConstructor
@AllArgsConstructor
public class SystemSettings {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String settingKey;

    @Column(columnDefinition = "TEXT")
    private String settingValue;

    @Column(nullable = false)
    private String category; // SYSTEM | NOTIFICATION | SECURITY

    private Long userId; // null = system-wide
}
