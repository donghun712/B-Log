package com.blog.backend.practice;

public record PracticeTrustCheckResponse(
    boolean warning,
    double multiplier,
    double recentAverageHitRate,
    String message
) {
}
