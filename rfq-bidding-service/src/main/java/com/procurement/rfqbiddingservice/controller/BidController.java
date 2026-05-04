package com.procurement.rfqbiddingservice.controller;

import com.procurement.rfqbiddingservice.dto.*;
import com.procurement.rfqbiddingservice.service.RFQService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/bids")
@RequiredArgsConstructor
public class BidController {
    
    private final RFQService rfqService;
    
    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'OFFICER', 'VENDOR')")
    public ResponseEntity<BidResponse> submitBid(@Valid @RequestBody BidRequest request) {
        return ResponseEntity.ok(rfqService.submitBid(request));
    }
    
    @GetMapping("/rfq/{rfqId}")
    @PreAuthorize("hasAnyRole('ADMIN', 'OFFICER', 'MANAGER', 'AUDITOR', 'VENDOR')")
    public ResponseEntity<List<BidResponse>> getBidsByRFQ(@PathVariable Long rfqId) {
        return ResponseEntity.ok(rfqService.getBidsByRFQ(rfqId));
    }
    
    @GetMapping("/vendor/{vendorId}")
    @PreAuthorize("hasAnyRole('ADMIN', 'OFFICER', 'MANAGER', 'AUDITOR', 'VENDOR')")
    public ResponseEntity<List<BidResponse>> getBidsByVendor(@PathVariable Long vendorId) {
        return ResponseEntity.ok(rfqService.getBidsByVendor(vendorId));
    }
    
    @GetMapping("/rfq/{rfqId}/ranked")
    @PreAuthorize("hasAnyRole('ADMIN', 'OFFICER', 'MANAGER', 'AUDITOR')")
    public ResponseEntity<List<BidResponse>> getRankedBids(@PathVariable Long rfqId) {
        return ResponseEntity.ok(rfqService.getRankedBids(rfqId));
    }
    
    @PostMapping("/{bidId}/evaluate")
    @PreAuthorize("hasAnyRole('ADMIN', 'OFFICER')")
    public ResponseEntity<BidResponse> evaluateBid(@PathVariable Long bidId) {
        return ResponseEntity.ok(rfqService.evaluateBid(bidId));
    }
}
