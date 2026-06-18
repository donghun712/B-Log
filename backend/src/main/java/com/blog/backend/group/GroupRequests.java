package com.blog.backend.group;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public final class GroupRequests {
    private GroupRequests() {
    }

    public record Create(@NotBlank @Size(max = 120) String name) {
    }

    public record Join(@NotBlank @Size(min = 6, max = 6) String inviteCode) {
    }
}
