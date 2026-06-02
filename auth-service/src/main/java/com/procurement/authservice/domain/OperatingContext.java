package com.procurement.authservice.domain;

/** Active hat for BOTH organisations — one context per JWT session. */
public enum OperatingContext {
    PROCUREMENT,
    SALES
}
