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
import java.util.Set;

@Repository
public interface BidRepository extends JpaRepository<Bid, Long> {
    List<Bid> findByRfqId(Long rfqId);
    List<Bid> findByVendorId(Long vendorId);
    Optional<Bid> findByRfqIdAndVendorId(Long rfqId, Long vendorId);
    List<Bid> findByRfqIdOrderByTotalScoreDesc(Long rfqId);
    List<Bid> findByVendorIdInAndStatus(Set<Long> vendorIds, String status);

    /** Returns a map of rfqId → bid count for all given rfqIds in a single query — eliminates N+1. */
    @Query("SELECT b.rfqId AS rfqId, COUNT(b) AS bidCount FROM Bid b WHERE b.rfqId IN :rfqIds GROUP BY b.rfqId")
    List<Map<String, Object>> countBidsByRfqIds(@Param("rfqIds") List<Long> rfqIds);

    /**
     * Finds all bids by a vendor across every tenant using a native query.
     * Native queries bypass the Hibernate @Filter, so vendor users can see
     * their own bids regardless of which buyer tenant the RFQ belongs to.
     */
    @Query(value = "SELECT * FROM bid WHERE vendor_id = :vendorId ORDER BY submitted_at DESC",
           nativeQuery = true)
    List<Bid> findByVendorIdAllTenants(@Param("vendorId") Long vendorId);

    /** Bulk-reject all bids for an RFQ except the awarded one — replaces the per-bid save loop. */
    @Modifying
    @Query("UPDATE Bid b SET b.status = 'Rejected' WHERE b.rfqId = :rfqId AND b.bidId <> :awardedBidId")
    int rejectOtherBids(@Param("rfqId") Long rfqId, @Param("awardedBidId") Long awardedBidId);
}
