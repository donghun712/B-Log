package com.blog.backend.auth;

import jakarta.validation.constraints.NotBlank;

public final class KakaoAuthRequests {
    private KakaoAuthRequests() {
    }

    public record Exchange(@NotBlank String code, @NotBlank String state, @NotBlank String redirectUri) {
    }
}
