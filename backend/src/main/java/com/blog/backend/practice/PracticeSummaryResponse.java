package com.blog.backend.practice;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;

public record PracticeSummaryResponse(
    Long id,
    String clientSessionId,
    String userId,
    String rangeId,
    String rangeName,
    LocalDate practiceDate,
    OffsetDateTime practicedAt,
    String mode,
    int totalShots,
    int totalHits,
    boolean isRankingPublic,
    LocalDateTime createdAt,
    LocalDateTime updatedAt
) {
    static PracticeSummaryResponse from(PracticeSummary summary) {
        return new PracticeSummaryResponse(
            summary.getId(),
            summary.getClientSessionId(),
            summary.getUser().getFirebaseUid(),
            summary.getRangeId(),
            summary.getRangeName(),
            summary.getPracticeDate(),
            summary.getPracticedAt(),
            summary.getRecordMode(),
            summary.getTotalShots(),
            summary.getTotalHits(),
            summary.isRankingPublic(),
            summary.getCreatedAt(),
            summary.getUpdatedAt()
        );
    }
}
