package com.blog.backend.admin;

import com.blog.backend.user.AppUser;

public record AdminUserResponse(
    Long id,
    String userId,
    String email,
    String name,
    String rangeId,
    String rangeName,
    String grade,
    boolean rankingPublic,
    long practiceSummaries,
    long totalShots,
    long totalHits,
    double hitRate
) {
    static AdminUserResponse from(AppUser user, long practiceSummaries, long totalShots, long totalHits) {
        double hitRate = totalShots == 0 ? 0 : (double) totalHits / totalShots;
        return new AdminUserResponse(
            user.getId(),
            user.getFirebaseUid(),
            user.getEmail(),
            user.getName(),
            user.getRangeId(),
            user.getRangeName(),
            user.getGrade(),
            user.isRankingPublic(),
            practiceSummaries,
            totalShots,
            totalHits,
            hitRate
        );
    }
}
