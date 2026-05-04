package com.procurement.notificationservice.repository;

import com.procurement.notificationservice.entity.Notification;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface NotificationRepository extends JpaRepository<Notification, Long> {
    List<Notification> findByUserId(Long userId);
    List<Notification> findByUserIdAndStatus(Long userId, String status);
    List<Notification> findByCategory(String category);
    List<Notification> findByStatus(String status);
}
