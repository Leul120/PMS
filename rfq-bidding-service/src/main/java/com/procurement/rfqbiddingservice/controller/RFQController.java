package com.procurement.rfqbiddingservice.controller;

import com.procurement.rfqbiddingservice.dto.*;
import com.procurement.rfqbiddingservice.service.RFQService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/rfqs")
@RequiredArgsConstructor
public class RFQController {

    private final RFQService rfqService;

    @PostMapping
    public ResponseEntity<RFQResponse> createRFQ(@Valid @RequestBody RFQRequest request) {
        return ResponseEntity.ok(rfqService.createRFQ(request, currentUserId()));
    }

    @GetMapping
    public ResponseEntity<PagedResponse<RFQResponse>> getAllRFQs(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String statuses,
            @RequestParam(required = false) Long categoryId,
            @RequestParam(required = false, defaultValue = "created-desc") String sort) {
        return ResponseEntity.ok(rfqService.getAllRFQs(
            page, size, search, status, statuses, categoryId, sort));
    }

    @GetMapping("/status/{status}")
    public ResponseEntity<List<RFQResponse>> getRFQsByStatus(@PathVariable String status) {
        return ResponseEntity.ok(rfqService.getRFQsByStatus(status));
    }

    @GetMapping("/{rfqId}")
    public ResponseEntity<RFQResponse> getRFQ(@PathVariable Long rfqId) {
        return ResponseEntity.ok(rfqService.getRFQ(rfqId));
    }

    @PutMapping("/{rfqId}")
    public ResponseEntity<RFQResponse> updateRFQ(
            @PathVariable Long rfqId,
            @Valid @RequestBody RFQRequest request) {
        return ResponseEntity.ok(rfqService.updateRFQ(rfqId, request));
    }

    @PostMapping("/{rfqId}/close")
    public ResponseEntity<RFQResponse> closeRFQ(@PathVariable Long rfqId) {
        return ResponseEntity.ok(rfqService.closeRFQ(rfqId));
    }

    @PostMapping("/{rfqId}/cancel")
    public ResponseEntity<RFQResponse> cancelRFQ(@PathVariable Long rfqId) {
        return ResponseEntity.ok(rfqService.cancelRFQ(rfqId));
    }

    @GetMapping("/{rfqId}/winning-bid")
    public ResponseEntity<BidResponse> getWinningBid(@PathVariable Long rfqId) {
        return ResponseEntity.ok(rfqService.getWinningBid(rfqId));
    }

    private Long currentUserId() {
        return (Long) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
    }
}
