package com.procurement.deliveryinvoiceservice.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DisputeResponse {
    private Long disputeId;
    private Long poId;
    private Long deliveryId;
    private Long invoiceId;
    private Long raisedBy;
    private String raisedByRole;
    private String disputeType;
    private String description;
    private String status;
    private String resolution;
    private Long resolvedBy;
    private LocalDateTime raisedAt;
    private LocalDateTime resolvedAt;
}
