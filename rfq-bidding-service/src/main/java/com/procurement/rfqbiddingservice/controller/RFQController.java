package com.procurement.rfqbiddingservice.controller;

import com.procurement.rfqbiddingservice.dto.*;
import com.procurement.rfqbiddingservice.service.RFQService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
@RestController
@RequestMapping("/api/rfqs")
@RequiredArgsConstructor
public class RFQController {

    private final RFQService rfqService;

    @PostMapping
    public ResponseEntity<RFQResponse> createRFQ(
            @Valid @RequestBody RFQRequest request,
            @RequestHeader("X-User-Id") Long userId) {
        return ResponseEntity.ok(rfqService.createRFQ(request, userId));
    }

    @GetMapping
    public ResponseEntity<PagedResponse<RFQResponse>> getAllRFQs(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {
        return ResponseEntity.ok(rfqService.getAllRFQs(page, size));
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
}
