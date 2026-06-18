package com.blog.backend.backup;

import jakarta.validation.constraints.NotBlank;

public final class BackupRequests {
    private BackupRequests() {
    }

    public record Save(@NotBlank String payload) {
    }
}
