package com.blog.backend.group;

import java.time.LocalDateTime;

public record GroupResponse(
    Long id,
    String name,
    String inviteCode,
    boolean owner,
    long memberCount,
    LocalDateTime createdAt
) {
    static GroupResponse from(GroupMember member, long memberCount) {
        return new GroupResponse(
            member.getGroup().getId(),
            member.getGroup().getName(),
            member.getGroup().getInviteCode(),
            "OWNER".equals(member.getRole()),
            memberCount,
            member.getGroup().getCreatedAt()
        );
    }
}
