package com.procurement.rfqbiddingservice.repository;

import com.procurement.rfqbiddingservice.entity.RFQ;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface RFQRepository extends JpaRepository<RFQ, Long> {
    List<RFQ> findByStatus(String status);
    List<RFQ> findByStatusAndDeadlineBefore(String status, LocalDateTime deadline);
    List<RFQ> findByCreatedBy(Long createdBy);
}
