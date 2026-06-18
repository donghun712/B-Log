package com.blog.backend.admin;

public record AdminOverviewResponse(
    long users,
    long practiceSummaries,
    long ranges,
    long groups,
    long groupMembers
) {
}
