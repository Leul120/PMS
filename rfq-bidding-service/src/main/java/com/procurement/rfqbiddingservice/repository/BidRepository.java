package com.procurement.rfqbiddingservice.repository;

import com.procurement.rfqbiddingservice.entity.Bid;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface BidRepository extends JpaRepository<Bid, Long> {
    List<Bid> findByRfqId(Long rfqId);
    List<Bid> findByVendorId(Long vendorId);
    Optional<Bid> findByRfqIdAndVendorId(Long rfqId, Long vendorId);
    List<Bid> findByRfqIdOrderByTotalScoreDesc(Long rfqId);
}
