package com.procurement.rfqbiddingservice.event;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RFQPublishedEvent {
    private Long rfqId;
    private String title;
    private LocalDateTime deadline;
    private BigDecimal estimatedValue;
    private Long categoryId;
    private LocalDateTime publishedAt;
}
