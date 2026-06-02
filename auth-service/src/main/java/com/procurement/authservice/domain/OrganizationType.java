package com.procurement.authservice.domain;

/**
 * How an organisation participates on the platform (enterprise trading-partner model).
 */
public enum OrganizationType {
    /** Procures from suppliers only */
    BUYER,
    /** Sells to customers only (supplier portal) */
    SUPPLIER,
    /** Both procure and sell — users switch Procurement vs Sales context */
    BOTH
}
