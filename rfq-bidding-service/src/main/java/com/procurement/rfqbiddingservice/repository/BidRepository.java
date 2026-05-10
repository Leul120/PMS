package com.procurement.rfqbiddingservice.repository;

import com.procurement.rfqbiddingservice.entity.Bid;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Map;
import java.util.Optional;

@Repository
public interface BidRepository extends JpaRepository<Bid, Long> {
    List<Bid> findByRfqId(Long rfqId);
    List<Bid> findByVendorId(Long vendorId);
    Optional<Bid> findByRfqIdAndVendorId(Long rfqId, Long vendorId);
    List<Bid> findByRfqIdOrderByTotalScoreDesc(Long rfqId);

    /** Returns a map of rfqId → bid count for all given rfqIds in a single query — eliminates N+1. */
    @Query("SELECT b.rfqId AS rfqId, COUNT(b) AS bidCount FROM Bid b WHERE b.rfqId IN :rfqIds GROUP BY b.rfqId")
    List<Map<String, Object>> countBidsByRfqIds(@Param("rfqIds") List<Long> rfqIds);

    /** Bulk-reject all bids for an RFQ except the awarded one — replaces the per-bid save loop. */
    @Modifying
    @Query("UPDATE Bid b SET b.status = 'Rejected' WHERE b.rfqId = :rfqId AND b.bidId <> :awardedBidId")
    int rejectOtherBids(@Param("rfqId") Long rfqId, @Param("awardedBidId") Long awardedBidId);
}
