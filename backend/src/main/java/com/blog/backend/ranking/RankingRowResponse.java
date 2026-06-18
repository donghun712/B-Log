package com.blog.backend.ranking;

public record RankingRowResponse(
    int rank,
    String userId,
    String name,
    String rangeId,
    String rangeName,
    int totalShots,
    int totalHits,
    double hitRate
) {
}
