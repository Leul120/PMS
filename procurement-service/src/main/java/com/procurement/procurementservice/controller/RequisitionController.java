package com.procurement.procurementservice.controller;

import com.procurement.procurementservice.dto.*;
import com.procurement.procurementservice.service.RequisitionService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/procurement/requisitions")
@RequiredArgsConstructor
public class RequisitionController {

    private final RequisitionService requisitionService;

    @PostMapping
    public ResponseEntity<RequisitionResponse> createRequisition(
            @Valid @RequestBody RequisitionRequest request) {
        return ResponseEntity.ok(requisitionService.createRequisition(request, currentUserId()));
    }

    @GetMapping
    public ResponseEntity<PagedResponse<RequisitionResponse>> getAllRequisitions(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String statuses,
            @RequestParam(required = false, defaultValue = "date-desc") String sort) {
        return ResponseEntity.ok(requisitionService.getAllRequisitions(
            page, size, search, status, statuses, sort));
    }

    @GetMapping("/{requisitionId}")
    public ResponseEntity<RequisitionResponse> getRequisition(@PathVariable Long requisitionId) {
        return ResponseEntity.ok(requisitionService.getRequisition(requisitionId));
    }

    @GetMapping("/my-requisitions")
    public ResponseEntity<List<RequisitionResponse>> getMyRequisitions() {
        return ResponseEntity.ok(requisitionService.getMyRequisitions(currentUserId()));
    }

    @GetMapping("/status/{status}")
    public ResponseEntity<List<RequisitionResponse>> getRequisitionsByStatus(@PathVariable String status) {
        return ResponseEntity.ok(requisitionService.getRequisitionsByStatus(status));
    }

    @PostMapping("/{requisitionId}/submit")
    public ResponseEntity<RequisitionResponse> submitRequisition(@PathVariable Long requisitionId) {
        return ResponseEntity.ok(requisitionService.submitRequisition(requisitionId, currentUserId()));
    }

    @PostMapping("/{requisitionId}/approve")
    public ResponseEntity<RequisitionResponse> approveRequisition(
            @PathVariable Long requisitionId,
            @Valid @RequestBody ApprovalRequest request) {
        String userRole = SecurityContextHolder.getContext().getAuthentication()
            .getAuthorities().stream().findFirst()
            .map(a -> a.getAuthority().replace("ROLE_", ""))
            .orElse("MANAGER");
        return ResponseEntity.ok(requisitionService.approveRequisition(requisitionId, request, currentUserId(), userRole));
    }

    private Long currentUserId() {
        return (Long) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
    }
}
