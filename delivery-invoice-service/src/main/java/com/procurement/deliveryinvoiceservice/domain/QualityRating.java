package com.procurement.deliveryinvoiceservice.domain;

/**
 * Structured receipt inspection outcome — source of truth for quality scoring.
 */
public enum QualityRating {
    ACCEPTED,
    ACCEPTED_WITH_ISSUES,
    REJECTED
}
