package com.procurement.analyticsservice.exception;

import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.bind.support.WebExchangeBindException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.server.ServerWebInputException;

import java.time.LocalDateTime;

@RestControllerAdvice
@Slf4j
public class GlobalExceptionHandler {

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ErrorResponse> handleAccessDenied(AccessDeniedException ex) {
        log.warn("Access denied: {}", ex.getMessage());
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(ErrorResponse.builder()
            .timestamp(LocalDateTime.now()).status(HttpStatus.FORBIDDEN.value())
            .error("Forbidden").message("You do not have permission to perform this action").build());
    }

    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<ErrorResponse> handleTypeMismatch(MethodArgumentTypeMismatchException ex) {
        String message = String.format("Invalid value '%s' for parameter '%s'. Expected type: %s",
            ex.getValue(), ex.getName(), ex.getRequiredType() != null ? ex.getRequiredType().getSimpleName() : "unknown");
        log.warn("Type mismatch: {}", message);
        return ResponseEntity.badRequest().body(ErrorResponse.builder()
            .timestamp(LocalDateTime.now()).status(HttpStatus.BAD_REQUEST.value())
            .error("Type Mismatch").message(message).build());
    }

    @ExceptionHandler(ServerWebInputException.class)
    public ResponseEntity<ErrorResponse> handleServerWebInputException(ServerWebInputException ex) {
        log.warn("Input error: {}", ex.getMessage());
        return ResponseEntity.badRequest().body(ErrorResponse.builder()
            .timestamp(LocalDateTime.now()).status(HttpStatus.BAD_REQUEST.value())
            .error("Bad Request").message(ex.getMessage()).build());
    }

    @ExceptionHandler(WebExchangeBindException.class)
    public ResponseEntity<ErrorResponse> handleWebExchangeBindException(WebExchangeBindException ex) {
        log.warn("Validation error: {}", ex.getMessage());
        return ResponseEntity.badRequest().body(ErrorResponse.builder()
            .timestamp(LocalDateTime.now()).status(HttpStatus.BAD_REQUEST.value())
            .error("Validation Error").message(ex.getMessage()).build());
    }

    @ExceptionHandler(RuntimeException.class)
    public ResponseEntity<ErrorResponse> handleRuntimeException(RuntimeException ex) {
        String msg = ex.getMessage() != null ? ex.getMessage().toLowerCase() : "";
        HttpStatus status = msg.contains("not found") ? HttpStatus.NOT_FOUND : HttpStatus.BAD_REQUEST;
        String error = msg.contains("not found") ? "Not Found" : "Bad Request";
        log.error("[{}] {}", status.value(), ex.getMessage());
        return ResponseEntity.status(status).body(ErrorResponse.builder()
            .timestamp(LocalDateTime.now()).status(status.value())
            .error(error).message(ex.getMessage()).build());
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleException(Exception ex) {
        log.error("Unexpected error: {}", ex.getMessage(), ex);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(ErrorResponse.builder()
            .timestamp(LocalDateTime.now()).status(HttpStatus.INTERNAL_SERVER_ERROR.value())
            .error("Internal Server Error").message("An unexpected error occurred").build());
    }
}
