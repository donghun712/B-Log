package com.blog.backend.admin;

public record AdminCurrentResponse(
    String username,
    String role,
    String rangeId,
    String rangeName,
    boolean active,
    boolean mustChangePassword
) {
}
