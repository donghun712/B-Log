package com.blog.backend.user;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public record UserProfileRequest(
    @NotBlank String name,
    @NotBlank String rangeId,
    @NotBlank String rangeName,
    @NotBlank String grade,
    @Pattern(regexp = "left|right") String bowHand,
    @Pattern(regexp = "simple|detail") String defaultRecordMode,
    boolean isRankingPublic
) {
}
