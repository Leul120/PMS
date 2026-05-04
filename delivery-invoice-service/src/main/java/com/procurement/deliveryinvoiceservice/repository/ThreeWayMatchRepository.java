package com.procurement.deliveryinvoiceservice.repository;

import com.procurement.deliveryinvoiceservice.entity.ThreeWayMatch;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface ThreeWayMatchRepository extends JpaRepository<ThreeWayMatch, Long> {
    Optional<ThreeWayMatch> findByPoId(Long poId);
    Optional<ThreeWayMatch> findByInvoiceId(Long invoiceId);
}
