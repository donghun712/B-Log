package com.blog.backend.ai;

import java.math.BigDecimal;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public final class AiRequests {
    private AiRequests() {
    }

    public record Feedback(
        @NotBlank @Size(max = 4000) String recentShotSummary,
        @Size(max = 1000) String userQuestion
    ) {
    }

    public record Nearby(
        @NotBlank String rangeName,
        BigDecimal latitude,
        BigDecimal longitude,
        @Size(max = 200) String note
    ) {
    }
}
