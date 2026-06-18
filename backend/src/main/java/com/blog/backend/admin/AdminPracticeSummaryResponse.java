package com.blog.backend.admin;

import java.time.LocalDate;
import java.time.OffsetDateTime;

import com.blog.backend.practice.PracticeSummary;

public record AdminPracticeSummaryResponse(
    Long id,
    String userId,
    String userName,
    String rangeId,
    String rangeName,
    LocalDate practiceDate,
    OffsetDateTime practicedAt,
    String recordMode,
    int totalShots,
    int totalHits,
    boolean rankingPublic
) {
    static AdminPracticeSummaryResponse from(PracticeSummary summary) {
        return new AdminPracticeSummaryResponse(
            summary.getId(),
            summary.getUser().getFirebaseUid(),
            summary.getUser().getName(),
            summary.getRangeId(),
            summary.getRangeName(),
            summary.getPracticeDate(),
            summary.getPracticedAt(),
            summary.getRecordMode(),
            summary.getTotalShots(),
            summary.getTotalHits(),
            summary.isRankingPublic()
        );
    }
}
