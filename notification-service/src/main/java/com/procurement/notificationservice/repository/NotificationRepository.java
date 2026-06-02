package com.procurement.notificationservice.repository;

import com.procurement.notificationservice.entity.Notification;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface NotificationRepository extends JpaRepository<Notification, Long> {
    List<Notification> findByUserId(Long userId);
    List<Notification> findByUserIdAndStatus(Long userId, String status);
    List<Notification> findByCategory(String category);
    List<Notification> findByStatus(String status);

    @Query("SELECT n FROM Notification n WHERE n.userId = :userId OR n.userId IS NULL ORDER BY n.createdAt DESC")
    List<Notification> findByUserIdOrBroadcast(@Param("userId") Long userId);

    @Query("SELECT n FROM Notification n WHERE (n.userId = :userId OR n.userId IS NULL) AND n.status = :status ORDER BY n.createdAt DESC")
    List<Notification> findByUserIdOrBroadcastAndStatus(@Param("userId") Long userId, @Param("status") String status);
}
