package com.blog.backend.group;

public record GroupMemberResponse(
    String userId,
    String name,
    String rangeId,
    String rangeName,
    boolean owner
) {
    static GroupMemberResponse from(GroupMember member) {
        return new GroupMemberResponse(
            member.getUser().getFirebaseUid(),
            member.getUser().getName(),
            member.getUser().getRangeId(),
            member.getUser().getRangeName(),
            "OWNER".equals(member.getRole())
        );
    }
}
