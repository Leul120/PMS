package com.procurement.rfqbiddingservice.controller;

import com.procurement.rfqbiddingservice.dto.*;
import com.procurement.rfqbiddingservice.service.RFQService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/bids")
@RequiredArgsConstructor
public class BidController {

    private final RFQService rfqService;

    @PostMapping
    public ResponseEntity<BidResponse> submitBid(
            @Valid @RequestBody BidRequest request,
            @AuthenticationPrincipal Long userId) {
        return ResponseEntity.ok(rfqService.submitBid(request, userId));
    }

    @GetMapping("/{bidId}")
    public ResponseEntity<BidResponse> getBidById(@PathVariable Long bidId) {
        return ResponseEntity.ok(rfqService.getBidById(bidId));
    }

    @GetMapping("/rfq/{rfqId}")
    public ResponseEntity<List<BidResponse>> getBidsByRFQ(
            @PathVariable Long rfqId,
            @AuthenticationPrincipal Long userId,
            Authentication authentication) {
        if (isVendorRole(authentication)) {
            return ResponseEntity.ok(rfqService.getBidsByRFQForVendor(rfqId, userId));
        }
        return ResponseEntity.ok(rfqService.getBidsByRFQ(rfqId));
    }

    private boolean isVendorRole(Authentication auth) {
        if (auth == null) return false;
        return auth.getAuthorities().stream()
            .anyMatch(a -> a.getAuthority().startsWith("ROLE_VENDOR_"));
    }

    @GetMapping("/vendor/{vendorId}")
    public ResponseEntity<List<BidResponse>> getBidsByVendor(@PathVariable Long vendorId) {
        return ResponseEntity.ok(rfqService.getBidsByVendor(vendorId));
    }

    @GetMapping("/rfq/{rfqId}/ranked")
    public ResponseEntity<List<BidResponse>> getRankedBids(@PathVariable Long rfqId) {
        return ResponseEntity.ok(rfqService.getRankedBids(rfqId));
    }

    @PostMapping("/{bidId}/evaluate")
    public ResponseEntity<BidResponse> evaluateBid(@PathVariable Long bidId) {
        return ResponseEntity.ok(rfqService.evaluateBid(bidId));
    }

    @PostMapping("/rfq/{rfqId}/evaluate-all")
    public ResponseEntity<List<BidResponse>> evaluateAllBids(@PathVariable Long rfqId) {
        return ResponseEntity.ok(rfqService.evaluateAllBids(rfqId));
    }

    @PostMapping("/{bidId}/award")
    public ResponseEntity<BidResponse> awardBid(@PathVariable Long bidId) {
        return ResponseEntity.ok(rfqService.awardBid(bidId));
    }
}
