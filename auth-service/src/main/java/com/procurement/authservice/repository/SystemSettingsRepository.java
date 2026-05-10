package com.procurement.authservice.repository;

import com.procurement.authservice.entity.SystemSettings;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface SystemSettingsRepository extends JpaRepository<SystemSettings, Long> {

    List<SystemSettings> findByCategoryAndUserId(String category, Long userId);

    Optional<SystemSettings> findBySettingKeyAndCategoryAndUserId(
        String settingKey, String category, Long userId);
}
