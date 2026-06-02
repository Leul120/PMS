package com.procurement.vendorservice.event;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class VendorVerifiedEvent {
    private Long tenantId;
    private Long vendorId;
    private String companyName;
    private String email;
    private String verifiedBy;
    private LocalDateTime verifiedAt;
}
