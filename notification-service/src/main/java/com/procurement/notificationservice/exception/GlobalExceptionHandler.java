package com.procurement.notificationservice.exception;

import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

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

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> handleValidation(MethodArgumentNotValidException ex) {
        Map<String, String> fieldErrors = new HashMap<>();
        ex.getBindingResult().getAllErrors().forEach(e ->
            fieldErrors.put(((FieldError) e).getField(), e.getDefaultMessage()));
        log.warn("Validation failed: {}", fieldErrors);
        return ResponseEntity.badRequest().body(ErrorResponse.builder()
            .timestamp(LocalDateTime.now()).status(HttpStatus.BAD_REQUEST.value())
            .error("Validation Error").message(fieldErrors.toString()).build());
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

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleException(Exception ex) {
        log.error("Unexpected error: {}", ex.getMessage(), ex);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(ErrorResponse.builder()
            .timestamp(LocalDateTime.now()).status(HttpStatus.INTERNAL_SERVER_ERROR.value())
            .error("Internal Server Error").message("An unexpected error occurred").build());
    }
}
