package com.procurement.rfqbiddingservice.repository;

import com.procurement.rfqbiddingservice.entity.RFQ;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface RFQRepository extends JpaRepository<RFQ, Long>, JpaSpecificationExecutor<RFQ> {
    List<RFQ> findByStatus(String status);
    List<RFQ> findByStatusAndDeadlineBefore(String status, LocalDateTime deadline);
    List<RFQ> findByCreatedBy(Long createdBy);
    List<RFQ> findByTenantIdAndStatus(Long tenantId, String status);
    Page<RFQ> findAll(Pageable pageable);

    /**
     * Pessimistic write lock — used during bid submission to prevent accepting
     * bids on an RFQ that is being concurrently closed.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT r FROM RFQ r WHERE r.rfqId = :id")
    Optional<RFQ> findByIdForUpdate(@Param("id") Long id);

    /**
     * Pessimistic write lock without tenant filter — used when a vendor (in a
     * different tenant) submits a bid on a buyer's RFQ.  Native SQL bypasses
     * the Hibernate @Filter so the row is always visible regardless of tenantId.
     *
     * <p><b>Lock-ordering rule:</b> a transaction must hold at most one
     * pessimistic row lock. {@code submitBid} locks only this single RFQ row,
     * so no circular wait is possible. If a future method must lock several
     * rows, acquire them in ascending {@code rfqId} order to preserve that
     * guarantee. The {@code FOR UPDATE} relies on a bounded {@code lock_timeout}
     * (set via the datasource {@code connection-init-sql}) so it fails fast
     * instead of waiting indefinitely on contention.
     */
    @Query(value = "SELECT * FROM rfq WHERE rfq_id = :id FOR UPDATE", nativeQuery = true)
    Optional<RFQ> findByIdForUpdateNative(@Param("id") Long id);

    /**
     * Single-row lookup without tenant filter — used when a vendor views
     * details of an RFQ that belongs to a different buyer tenant.
     */
    @Query(value = "SELECT * FROM rfq WHERE rfq_id = :id", nativeQuery = true)
    Optional<RFQ> findByIdNative(@Param("id") Long id);

    /**
     * Returns all Open RFQs across every tenant using a native query.
     * Native queries bypass the Hibernate @Filter, so vendor roles can see
     * open opportunities from any buyer organisation.
     */
    @Query(value = "SELECT * FROM rfq WHERE status = 'Open' ORDER BY created_at DESC",
           countQuery = "SELECT count(*) FROM rfq WHERE status = 'Open'",
           nativeQuery = true)
    Page<RFQ> findAllOpen(Pageable pageable);
}
