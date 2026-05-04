package com.procurement.procurementservice.controller;

import com.procurement.procurementservice.dto.*;
import com.procurement.procurementservice.service.RequisitionService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/procurement/requisitions")
@RequiredArgsConstructor
public class RequisitionController {
    
    private final RequisitionService requisitionService;
    
    @PostMapping
    @PreAuthorize("hasAnyRole('PROCUREMENT_OFFICER', 'MANAGER')")
    public ResponseEntity<RequisitionResponse> createRequisition(
            @Valid @RequestBody RequisitionRequest request,
            @RequestHeader("X-User-Id") Long userId) {
        return ResponseEntity.ok(requisitionService.createRequisition(request, userId));
    }
    
    @GetMapping
    @PreAuthorize("hasAnyRole('PROCUREMENT_OFFICER', 'MANAGER', 'ADMIN')")
    public ResponseEntity<List<RequisitionResponse>> getAllRequisitions() {
        return ResponseEntity.ok(requisitionService.getAllRequisitions());
    }
    
    @GetMapping("/{requisitionId}")
    public ResponseEntity<RequisitionResponse> getRequisition(@PathVariable Long requisitionId) {
        return ResponseEntity.ok(requisitionService.getRequisition(requisitionId));
    }
    
    @GetMapping("/my-requisitions")
    public ResponseEntity<List<RequisitionResponse>> getMyRequisitions(
            @RequestHeader("X-User-Id") Long userId) {
        return ResponseEntity.ok(requisitionService.getMyRequisitions(userId));
    }
    
    @GetMapping("/status/{status}")
    @PreAuthorize("hasAnyRole('PROCUREMENT_OFFICER', 'MANAGER', 'ADMIN')")
    public ResponseEntity<List<RequisitionResponse>> getRequisitionsByStatus(@PathVariable String status) {
        return ResponseEntity.ok(requisitionService.getRequisitionsByStatus(status));
    }
    
    @PostMapping("/{requisitionId}/approve")
    @PreAuthorize("hasAnyRole('MANAGER', 'ADMIN')")
    public ResponseEntity<RequisitionResponse> approveRequisition(
            @PathVariable Long requisitionId,
            @Valid @RequestBody ApprovalRequest request,
            @RequestHeader("X-User-Id") Long userId,
            @RequestHeader("X-User-Role") String userRole) {
        return ResponseEntity.ok(requisitionService.approveRequisition(requisitionId, request, userId, userRole));
    }
}
