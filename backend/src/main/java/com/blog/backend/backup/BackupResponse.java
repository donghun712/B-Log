package com.blog.backend.backup;

import java.time.LocalDateTime;

public record BackupResponse(Long id, String payload, int byteSize, LocalDateTime updatedAt) {
    static BackupResponse from(UserBackup backup) {
        return new BackupResponse(backup.getId(), backup.getPayload(), backup.getByteSize(), backup.getUpdatedAt());
    }
}
