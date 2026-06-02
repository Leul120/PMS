package com.procurement.authservice.tenant;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.ResponseStatus;

@ResponseStatus(HttpStatus.FORBIDDEN)
public class TenantAccessException extends RuntimeException {

    public TenantAccessException(String message) {
        super(message);
    }

    public TenantAccessException(String message, Throwable cause) {
        super(message, cause);
    }
}
