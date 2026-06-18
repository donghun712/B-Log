package com.blog.backend.admin;

public record AdminRangeStatsResponse(
    String rangeId,
    String rangeName,
    long members,
    long practiceSummaries,
    long totalShots,
    long totalHits,
    double hitRate
) {
}
