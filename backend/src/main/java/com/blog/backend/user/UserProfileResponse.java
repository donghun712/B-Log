package com.blog.backend.user;

public record UserProfileResponse(
    String name,
    String rangeId,
    String rangeName,
    String grade,
    String bowHand,
    String defaultRecordMode,
    boolean isRankingPublic
) {
    static UserProfileResponse from(AppUser user) {
        return new UserProfileResponse(
            user.getName(),
            user.getRangeId(),
            user.getRangeName(),
            user.getGrade(),
            user.getBowHand(),
            user.getDefaultRecordMode(),
            user.isRankingPublic()
        );
    }
}
