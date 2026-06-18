package com.blog.backend.admin;

import java.time.LocalDateTime;

public record AdminAccountResponse(
    Long id,
    String username,
    String role,
    String rangeId,
    String rangeName,
    boolean active,
    boolean mustChangePassword,
    LocalDateTime lastLoginAt,
    LocalDateTime createdAt
) {
    static AdminAccountResponse from(AdminAccount account) {
        return new AdminAccountResponse(
            account.getId(),
            account.getUsername(),
            account.getRole(),
            account.getRangeId(),
            account.getRangeName(),
            account.isActive(),
            account.isMustChangePassword(),
            account.getLastLoginAt(),
            account.getCreatedAt()
        );
    }
}
