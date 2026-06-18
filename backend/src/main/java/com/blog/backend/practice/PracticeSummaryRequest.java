package com.blog.backend.practice;

import java.time.LocalDate;
import java.time.OffsetDateTime;

import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;

public record PracticeSummaryRequest(
    @NotBlank String clientSessionId,
    @NotBlank String rangeId,
    @NotBlank String rangeName,
    @NotNull LocalDate practiceDate,
    @NotNull OffsetDateTime practicedAt,
    @Pattern(regexp = "simple|detail") String mode,
    @Min(1) int totalShots,
    @Min(0) int totalHits,
    boolean isRankingPublic,
    boolean confirmedOutlier
) {
    @AssertTrue(message = "totalHits must not exceed totalShots")
    boolean isHitCountValid() {
        return totalHits <= totalShots;
    }
}
