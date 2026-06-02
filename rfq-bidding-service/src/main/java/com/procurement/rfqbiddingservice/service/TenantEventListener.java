package com.procurement.rfqbiddingservice.service;

import com.procurement.rfqbiddingservice.entity.Bid;
import com.procurement.rfqbiddingservice.entity.RFQ;
import com.procurement.rfqbiddingservice.event.TenantSuspendedEvent;
import com.procurement.rfqbiddingservice.infrastructure.client.VendorClient;
import com.procurement.rfqbiddingservice.repository.BidRepository;
import com.procurement.rfqbiddingservice.repository.RFQRepository;
import com.procurement.rfqbiddingservice.tenant.TenantContext;
import com.procurement.rfqbiddingservice.workflow.BidStatus;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class TenantEventListener {

    private final RFQRepository rfqRepository;
    private final BidRepository bidRepository;
    private final VendorClient vendorClient;

    @KafkaListener(topics = "tenant.suspended", groupId = "rfq-service-tenant-group")
    @Transactional
    public void handleTenantSuspended(TenantSuspendedEvent event) {
        if (event == null || event.getTenantId() == null) return;

        Long tenantId = event.getTenantId();
        log.info("Tenant suspended event received: tenantId={}, domain={}",
            tenantId, event.getTenantDomain());

        TenantContext.setCurrentTenant(tenantId);
        try {
            // Cancel all open/published RFQs from the buyer tenant
            List<RFQ> openRfqs = rfqRepository.findByTenantIdAndStatus(tenantId, "Open");
            openRfqs.addAll(rfqRepository.findByTenantIdAndStatus(tenantId, "Published"));
            if (!openRfqs.isEmpty()) {
                openRfqs.forEach(rfq -> rfq.setStatus("Cancelled"));
                rfqRepository.saveAll(openRfqs);
                log.info("Cancelled {} open RFQ(s) for suspended tenant {}", openRfqs.size(), tenantId);
            }

            // Withdraw all submitted bids from vendors belonging to the suspended tenant
            try {
                List<Long> vendorIds = vendorClient.getVendorIdsByTenantId(tenantId);
                if (vendorIds != null && !vendorIds.isEmpty()) {
                    Set<Long> vendorIdSet = Set.copyOf(vendorIds);
                    List<Bid> activeBids = bidRepository.findByVendorIdInAndStatus(vendorIdSet, BidStatus.SUBMITTED);
                    activeBids.addAll(bidRepository.findByVendorIdInAndStatus(vendorIdSet, BidStatus.PENDING));
                    if (!activeBids.isEmpty()) {
                        activeBids.forEach(bid -> bid.setStatus(BidStatus.WITHDRAWN));
                        bidRepository.saveAll(activeBids);
                        log.info("Withdrawn {} bid(s) from vendors of suspended tenant {}", activeBids.size(), tenantId);
                    }
                }
            } catch (Exception e) {
                log.error("Failed to withdraw bids for suspended tenant {}: {}", tenantId, e.getMessage());
            }
        } finally {
            TenantContext.clear();
        }
    }
}
