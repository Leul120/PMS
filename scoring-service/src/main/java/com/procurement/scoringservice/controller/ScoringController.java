package com.procurement.scoringservice.controller;

import com.procurement.scoringservice.entity.VendorPerformanceRecord;
import com.procurement.scoringservice.entity.VendorScore;
import com.procurement.scoringservice.service.ScoringService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/scores")
@RequiredArgsConstructor
public class ScoringController {
    
    private final ScoringService scoringService;
    
    @PostMapping("/calculate/{vendorId}")
    public ResponseEntity<String> calculateScore(@PathVariable Long vendorId) {
        return ResponseEntity.ok("Score calculation triggered for vendor: " + vendorId);
    }
    
    @GetMapping("/vendor/{vendorId}")
    public ResponseEntity<List<VendorScore>> getVendorScores(@PathVariable Long vendorId) {
        return ResponseEntity.ok(scoringService.getScoresByVendor(vendorId));
    }
    
    @GetMapping("/ranking")
    public ResponseEntity<List<VendorScore>> getRanking() {
        return ResponseEntity.ok(scoringService.getAllScoresRanked());
    }
}
