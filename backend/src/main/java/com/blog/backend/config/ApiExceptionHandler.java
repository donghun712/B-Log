package com.blog.backend.config;

import java.time.Instant;
import java.util.Map;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.server.ResponseStatusException;

@RestControllerAdvice
public class ApiExceptionHandler {
    @ExceptionHandler(ResponseStatusException.class)
    ResponseEntity<Map<String, Object>> responseStatus(ResponseStatusException error) {
        return ResponseEntity.status(error.getStatusCode()).body(Map.of(
            "time", Instant.now().toString(),
            "message", error.getReason() == null ? "Request failed." : error.getReason()
        ));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<Map<String, Object>> validation(MethodArgumentNotValidException error) {
        String message = error.getAllErrors().isEmpty() ? "Validation failed." : error.getAllErrors().get(0).getDefaultMessage();
        return ResponseEntity.badRequest().body(Map.of("time", Instant.now().toString(), "message", message));
    }
}
