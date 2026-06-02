package com.procurement.rfqbiddingservice.event;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RFQPublishedEvent {
    private Long tenantId;
    private Long rfqId;
    private String title;
    private LocalDateTime deadline;
    private BigDecimal estimatedValue;
    private Long categoryId;
    private LocalDateTime publishedAt;
    private List<String> vendorEmails;
}
