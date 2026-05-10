package com.procurement.rfqbiddingservice.repository;

import com.procurement.rfqbiddingservice.entity.RFQ;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface RFQRepository extends JpaRepository<RFQ, Long> {
    List<RFQ> findByStatus(String status);
    List<RFQ> findByStatusAndDeadlineBefore(String status, LocalDateTime deadline);
    List<RFQ> findByCreatedBy(Long createdBy);
    Page<RFQ> findAll(Pageable pageable);

    /**
     * Pessimistic write lock — used during bid submission to prevent accepting
     * bids on an RFQ that is being concurrently closed.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT r FROM RFQ r WHERE r.rfqId = :id")
    Optional<RFQ> findByIdForUpdate(@Param("id") Long id);
}
